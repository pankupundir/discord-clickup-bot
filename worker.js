addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

const USERS = {
  pankaj: 95683778,
  andrew: 63119843,
  huz: 270664357
};

async function handleRequest(request) {

  const DISCORD_PUBLIC_KEY = globalThis.DISCORD_PUBLIC_KEY;
  const CLICKUP_API_TOKEN  = globalThis.CLICKUP_TOKEN;
  const CLICKUP_LIST_ID    = globalThis.LIST_ID;
  const DISCORD_BOT_TOKEN  = globalThis.DISCORD_BOT_TOKEN;
  const DISCORD_CHANNEL_ID = globalThis.DISCORD_CHANNEL_ID;

  if (request.method !== "POST") {
    return new Response("OK");
  }

  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");
  const body = await request.clone().text();

  const isValid = await verifyDiscordRequest(body, signature, timestamp, DISCORD_PUBLIC_KEY);

  if (!isValid) {
    return new Response("Invalid request signature", { status: 401 });
  }

  const jsonBody = JSON.parse(body);

  // Discord Ping
  if (jsonBody.type === 1) {
    return new Response(JSON.stringify({ type: 1 }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // ---------- AUTOCOMPLETE ----------
  if (jsonBody.type === 4) {

    const query = jsonBody.data.options[0]?.value || "";

    const tasks = await searchClickUpTasks(query, CLICKUP_API_TOKEN, CLICKUP_LIST_ID);

    const choices = tasks.slice(0,5).map(task => ({
      name: task.name,
      value: task.id
    }));

    return new Response(JSON.stringify({
      type: 8,
      data: { choices }
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // ---------- COMMAND EXECUTION ----------
  if (jsonBody.type === 2) {

    const command = jsonBody.data.name;

    const title  = jsonBody.data.options?.[0]?.value;
    const desc   = jsonBody.data.options?.[1]?.value;
    const assign = jsonBody.data.options?.[2]?.value;

    const assigneeId = assign ? USERS[assign.toLowerCase()] : null;
    const assignName = assign ? assign : "Unassigned";

    const creator = jsonBody.member?.user?.username || "Someone";

    // -------- CREATE TASK (ANNOUNCE) --------
    if (command === "task") {

      const taskUrl = await createClickUpTask(
        title,
        desc,
        assigneeId,
        CLICKUP_API_TOKEN,
        CLICKUP_LIST_ID
      );

      if (taskUrl) {

        const message =
`${creator} created a new task:

${title}

${desc}

Assigned to: ${assignName}

${taskUrl}`;

        await announceTask(DISCORD_CHANNEL_ID, DISCORD_BOT_TOKEN, message);
      }

      return new Response(JSON.stringify({
        type: 4,
        data: {
          content: taskUrl
            ? `✅ Task created\n${taskUrl}`
            : `❌ Failed to create task`
        }
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // -------- CREATE TASK SILENT --------
    if (command === "tasksilent") {

      const taskUrl = await createClickUpTask(
        title,
        desc,
        assigneeId,
        CLICKUP_API_TOKEN,
        CLICKUP_LIST_ID
      );

      return new Response(JSON.stringify({
        type: 4,
        data: {
          content: taskUrl
            ? `✅ Task created\n${taskUrl}`
            : `❌ Failed to create task`
        }
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // -------- CLICKUP SEARCH --------
    if (command === "clickup") {

      const taskId = jsonBody.data.options[0].value;

      const link = `https://app.clickup.com/t/${taskId}`;

      return new Response(JSON.stringify({
        type: 4,
        data: {
          content: `[Open ClickUp Task](${link})`,
          flags: 64
        }
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  return new Response("OK");
}

// ---------- CREATE TASK ----------
async function createClickUpTask(taskname, taskdesc, assigneeId, apiToken, listId) {

  const data = {
    name: taskname,
    description: taskdesc,
    assignees: assigneeId ? [assigneeId] : []
  };

  const response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": apiToken
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) return false;

  const res = await response.json();
  return res.url;
}

// ---------- SEARCH TASKS ----------
async function searchClickUpTasks(query, apiToken, listId) {

  const res = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
    headers: { Authorization: apiToken }
  });

  const data = await res.json();

  return data.tasks.filter(task =>
    task.name.toLowerCase().includes(query.toLowerCase())
  );
}

// ---------- ANNOUNCE TASK ----------
async function announceTask(channelId, botToken, message) {

  await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      content: message
    })
  });
}

// ---------- VERIFY DISCORD ----------
async function verifyDiscordRequest(body, signature, timestamp, publicKey) {

  const encoder = new TextEncoder();
  const data = encoder.encode(timestamp + body);

  const signatureArray = hexToUint8Array(signature);

  const key = await crypto.subtle.importKey(
    "raw",
    hexToUint8Array(publicKey),
    { name: "NODE-ED25519", namedCurve: "NODE-ED25519", public: true },
    true,
    ["verify"]
  );

  return crypto.subtle.verify("NODE-ED25519", key, signatureArray, data);
}

function hexToUint8Array(hexString) {
  const matches = hexString.match(/.{1,2}/g);
  return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}