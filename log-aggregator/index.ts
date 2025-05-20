import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { Messenger } from "./messenger";
import { z } from "zod";
import fs from "fs/promises";

const app = new Hono();

const messenger = new Messenger();

let highest = 0;

// Define the schema for the new score breakdown (for zeros)
const ScoreBreakdownZerosSchema = z.object({
	leading_zeros: z.number(),
	extra_leading_zeros: z.number(),
	other_zeros: z.number(),
});

const LogSchema = z.object({
	score: z.number(),
	address: z.string(),
	salt: z.string(),
	score_breakdown: ScoreBreakdownZerosSchema, // Use the new zeros breakdown schema
});

// Endpoint to submit logs
app.post("/", async (c) => {
	try {
		const body = await c.req.json();
		const data = LogSchema.parse(body);
		console.log(data);

		if (data.score > highest) {
			highest = data.score;
			const prettyJson = JSON.stringify(data, null, 2);
			messenger.sendMessage(prettyJson);
			try {
				await fs.appendFile("scores.log", prettyJson + "\n", "utf8");
				console.log("Score saved to scores.log");
			} catch (err) {
				console.error("Failed to write score to log file:", err);
			}
		}

		return c.json(200);
	} catch (error) {
		console.log(`Error: ${error}`);
		return c.json(400);
	}
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

console.log(`Server is running on port ${port}`);

serve({
	fetch: app.fetch,
	port,
});
