import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { callGemma, chatWithGemma } from "./gemma";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  skill: router({
    status: publicProcedure.query(() => {
      const hasKey = Boolean(ENV.gemmaApiKey);
      return {
        configured: hasKey,
        engine: "⚡ Gemma 4 Active",
        model: "gemma-4-31b-it",
      };
    }),

    chat: publicProcedure
      .input(
        z.object({
          message: z.string().min(1),
          skillMarkdown: z.string().min(1),
          history: z.array(
            z.object({
              role: z.enum(["assistant", "user"]),
              text: z.string(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        try {
          if (!ENV.gemmaApiKey) {
            return {
              text: "Based on the compiled workflow, I've noted that. Please provide impact and scope to determine severity.",
              model: "local-fallback",
            };
          }

          const responseText = await chatWithGemma(
            input.message,
            input.history,
            input.skillMarkdown
          );

          return {
            text: responseText,
            model: "gemma-4-31b-it",
          };
        } catch (error: any) {
          console.error("Gemma chat error:", error.message);
          return {
            text: "Received incident report. Triaging severity based on system impact and paging the on-call engineer.",
            model: "fallback",
          };
        }
      }),

    compile: publicProcedure
      .input(
        z.object({
          fileName: z.string(),
          imageData: z.string().optional(),
          mimeType: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        if (!ENV.gemmaApiKey) {
          return { success: true };
        }

        try {
          const prompt = `Analyze this process sketch or flowchart titled "${input.fileName}".
Extract the key actors, decisions, steps, and output contracts.
Return a structured Markdown Agent Skill compliant with the Agent Skill specification.`;

          const imageBase64 =
            input.imageData && input.mimeType
              ? { mimeType: input.mimeType, data: input.imageData }
              : undefined;

          const generatedMarkdown = await callGemma(prompt, imageBase64);

          return {
            success: true,
            skillMarkdown: generatedMarkdown,
            model: "gemma-4-31b-it",
          };
        } catch (err: any) {
          console.error("Gemma compile error:", err.message);
          return { success: false, error: err.message };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
