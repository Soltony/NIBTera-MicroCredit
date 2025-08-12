
<<<<<<< HEAD
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
=======
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(user);
  } catch (error) {
    console.error('API User Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
>>>>>>> f49e01af9eeac04f496112898a30f84b9bf97f7c
}
