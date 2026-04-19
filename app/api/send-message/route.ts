import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { text } = await request.json();
        console.log("[SEND-MESSAGE API] Received request to send:", text);

        const botUrl = process.env.WHATSAPP_BOT_URL || 'http://localhost:3001/send-message';
        const groupId = process.env.WHATSAPP_ATTENDANCE_GROUP_ID || '120363433079394966@g.us';

        console.log(`[SEND-MESSAGE API] Forwarding to Bot URL: ${botUrl} for Group: ${groupId}`);
        
        const res = await fetch(botUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId, text })
        });
        
        console.log(`[SEND-MESSAGE API] Bot response status: ${res.status}`);
        
        let responseJson;
        try {
            responseJson = await res.json();
            console.log("[SEND-MESSAGE API] Bot JSON:", responseJson);
        } catch (e) {
            console.log("[SEND-MESSAGE API] Bot did not return JSON.");
        }
        
        if (!res.ok || (responseJson && responseJson.error)) {
           console.error("[SEND-MESSAGE API] Bot officially rejected the message.");
           throw new Error(responseJson?.error || 'Bot returned non-OK status');
        }

        return NextResponse.json({ status: 'success', sent: true });
    } catch (e: any) {
        console.error("[SEND-MESSAGE API] Crash:", e.message);
        return NextResponse.json({ status: 'error', error: e.message }, { status: 500 });
    }
}
