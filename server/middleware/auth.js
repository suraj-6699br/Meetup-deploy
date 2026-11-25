import { getAuth, clerkClient } from "@clerk/express"
import { sql } from "../config/db.js"

export const protect = async (req, res, next) => {
    try {
        const auth = getAuth(req);
        const userId = auth?.userId || req.auth?.userId;

        if(!userId){
            return res.status(401).json({ error: "Not authorized, authentication required" });
        }

        req.user = {id: userId};

        const userActivePlan = auth.has({plan: "premium"}) ? "premium" : "free";

        const users = await sql`SELECT name, plan FROM users WHERE id = ${userId}`

        // If user doesn't exist in DB yet (webhook may not have fired), insert them now
        if (users.length === 0) {
            let userName = "User";
            let userEmail = `${userId}@meetup.user`;
            let userImage = "";

            try {
                const clerkUser = await clerkClient.users.getUser(userId);
                if (clerkUser) {
                    userName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || clerkUser.username || "User";
                    userEmail = clerkUser.emailAddresses?.[0]?.emailAddress || `${userId}@meetup.user`;
                    userImage = clerkUser.imageUrl || "";
                }
            } catch (clerkErr) {
                console.warn("[Auth Middleware] Could not fetch user details from Clerk API:", clerkErr.message);
            }

            // Ensure email uniqueness to avoid constraint violation
            const existingWithEmail = await sql`SELECT id FROM users WHERE email = ${userEmail} AND id != ${userId}`;
            if (existingWithEmail.length > 0) {
                userEmail = `${userId}.${userEmail}`;
            }

            await sql`
                INSERT INTO users (id, name, email, image, plan)
                VALUES (${userId}, ${userName}, ${userEmail}, ${userImage}, ${userActivePlan})
                ON CONFLICT (id) DO UPDATE SET 
                    name = EXCLUDED.name,
                    email = EXCLUDED.email,
                    image = EXCLUDED.image,
                    plan = EXCLUDED.plan,
                    updated_at = NOW()
            `;
            return next();
        }

        const userPlan = users[0]?.plan;

        if(userActivePlan !== userPlan){
            await sql`UPDATE users SET plan = ${userActivePlan}, updated_at = NOW() WHERE id = ${userId}`
        }

        next()
    } catch (err) {
        console.error("[Auth Middleware Error]:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}