import {
    BedrockRuntimeClient,
    InvokeModelCommand,
    InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";

// AWS Bedrock Client - ANTHROPIC_API_KEY нь base64 encoded "bedrockAPIKey-..." байна
// Bedrock-д зориулж AWS credentials ашиглана
// ANTHROPIC_API_KEY-г decode хийж AWS credentials болгоно

function parseBedrockApiKey(encoded: string): { accessKeyId: string; secretAccessKey: string; region: string } {
    try {
        // Base64 decode
        const decoded = Buffer.from(encoded.trim(), "base64").toString("utf-8");
        // Format: bedrockAPIKey-mf66-at-2144940984 26:a5Xz1G+wTnZR+Vt1+elByHjsmQMgX2xD/LYajPe0xSxk+PMNjwd2oJgbKjM=
        // Эсвэл AWS credentials format: accessKeyId:secretAccessKey:region
        const parts = decoded.split(":");
        if (parts.length >= 2) {
            return {
                accessKeyId: parts[0],
                secretAccessKey: parts.slice(1).join(":"),
                region: "us-east-1",
            };
        }
    } catch (e) {
        // ignore
    }
    // Fallback: environment variables ашиглана
    return {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
        region: process.env.AWS_REGION || "us-east-1",
    };
}

// Claude claude-opus-4-5 загварын ID (AWS Bedrock дээр)
const MODEL_ID = "us.anthropic.claude-opus-4-5-20251101-v1:0";

// Bedrock client үүсгэх
function createBedrockClient(): BedrockRuntimeClient {
    const apiKey = process.env.ANTHROPIC_API_KEY || "";

    // Хэрэв AWS credentials тус тусад нь тохируулсан бол тэдгээрийг ашиглана
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        return new BedrockRuntimeClient({
            region: process.env.AWS_REGION || "us-east-1",
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                sessionToken: process.env.AWS_SESSION_TOKEN,
            },
        });
    }

    // ANTHROPIC_API_KEY-г parse хийж credentials болгох оролдлого
    const creds = parseBedrockApiKey(apiKey);

    return new BedrockRuntimeClient({
        region: creds.region,
        credentials: {
            accessKeyId: creds.accessKeyId,
            secretAccessKey: creds.secretAccessKey,
        },
    });
}

const bedrockClient = createBedrockClient();

// ─── Non-streaming хариу авах ───────────────────────────────────────────────
export async function askClaude(
    system: string,
    userMessage: string,
    maxTokens = 1000
): Promise<string> {
    const body = JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: userMessage }],
    });

    const command = new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: Buffer.from(body),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    const block = responseBody.content?.[0];
    if (!block || block.type !== "text") throw new Error("Unexpected response type");
    return block.text;
}

// ─── Streaming хариу авах (SSE-д зориулсан) ────────────────────────────────
export async function streamClaude(
    system: string,
    userMessage: string,
    onChunk: (text: string) => void,
    maxTokens = 2000
): Promise<void> {
    const body = JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: userMessage }],
    });

    const command = new InvokeModelWithResponseStreamCommand({
        modelId: MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: Buffer.from(body),
    });

    const response = await bedrockClient.send(command);

    if (!response.body) throw new Error("Empty stream response");

    for await (const event of response.body) {
        if (event.chunk?.bytes) {
            const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
            if (chunk.type === "content_block_delta" && chunk.delta?.type === "text_delta") {
                onChunk(chunk.delta.text);
            }
        }
    }
}

// ─── Multi-turn conversation (history ажиллуулах) ──────────────────────────
export async function streamClaudeWithHistory(
    system: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    onChunk: (text: string) => void,
    maxTokens = 4000
): Promise<void> {
    const body = JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: maxTokens,
        system,
        messages,
    });

    const command = new InvokeModelWithResponseStreamCommand({
        modelId: MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: Buffer.from(body),
    });

    const response = await bedrockClient.send(command);

    if (!response.body) throw new Error("Empty stream response");

    for await (const event of response.body) {
        if (event.chunk?.bytes) {
            const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
            if (chunk.type === "content_block_delta" && chunk.delta?.type === "text_delta") {
                onChunk(chunk.delta.text);
            }
        }
    }
}