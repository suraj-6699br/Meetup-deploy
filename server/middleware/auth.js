import { getAuth } from "@clerk/express"
import {sql} from "../config/db.js"

export const protect = async (req, res, next) => {
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
        const clerkUser = auth;
        await sql`
            INSERT INTO users (id, name, email, plan)
            VALUES (${userId}, ${'User'}, ${''}, ${userActivePlan})
            ON CONFLICT (id) DO UPDATE SET plan = ${userActivePlan}, updated_at = NOW()
        `;
        return next();
    }

    const userPlan = users[0]?.plan;

    if(userActivePlan !== userPlan){
        await sql`UPDATE users SET plan = ${userActivePlan}, updated_at = NOW() WHERE id = ${userId}`
    }

    next()
}