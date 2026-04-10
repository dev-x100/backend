/**
 * Zoom Server-to-Server OAuth API service
 * Docs: https://developers.zoom.us/docs/internal-apps/
 */

interface ZoomTokenResponse {
  access_token: string;
  expires_in: number;
}

interface ZoomMeeting {
  id: string;
  join_url: string;
  start_url: string;
  password: string;
}

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Zoom credentials not configured");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Zoom token error: ${err}`);
  }

  const data = (await res.json()) as ZoomTokenResponse;
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

export async function createZoomMeeting(opts: {
  topic: string;
  startTime: Date;
  durationMin: number;
  password?: string;
}): Promise<ZoomMeeting> {
  const token = await getAccessToken();

  const res = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: opts.topic,
      type: 2, // Scheduled meeting
      start_time: opts.startTime.toISOString(),
      duration: opts.durationMin,
      password: opts.password ?? Math.random().toString(36).slice(2, 8).toUpperCase(),
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        waiting_room: true,
        registrants_email_notification: false, // We handle emails ourselves
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Zoom meeting creation failed: ${err}`);
  }

  const meeting = (await res.json()) as {
    id: number;
    join_url: string;
    start_url: string;
    password: string;
  };

  return {
    id: String(meeting.id),
    join_url: meeting.join_url,
    start_url: meeting.start_url,
    password: meeting.password,
  };
}

export async function deleteZoomMeeting(meetingId: string): Promise<void> {
  const token = await getAccessToken();

  await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
