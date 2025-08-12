
import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/user";

export async function GET() {
    try {
        const user = await getUserFromSession();
        if (user) {
            return NextResponse.json(user);
        }
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
