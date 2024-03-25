"use client";

import { useState } from "react";
import { useUIState, useActions } from "ai/rsc";
import type { AI } from "./action";
import { User } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Page() {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useUIState<typeof AI>();
  const { submitUserMessage } = useActions<typeof AI>();

  return (
    <div className="w-full">
      <div className="p-8 mx-auto max-w-[75%]">
        <h1 className="text-3xl font-bold text-center">
          Generative UI demo using Vercel AI SDK 3.0
        </h1>
        <div className="">
          {
            // View messages in UI state
            messages.map((message) => (
              <div>
                <div
                  className="rounded-lg my-8  bg-gray-100 dark:bg-gray-800 p-4 max-w-[75%]"
                  key={message.id}
                >
                  <p className="">{message.display}</p>
                </div>
              </div>
            ))
          }
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();

            // Add user message to UI state
            setMessages((currentMessages) => [
              ...currentMessages,
              {
                id: Date.now(),
                display: <div>{inputValue}</div>,
                role: "user",
              },
            ]);

            // Submit and get response message
            const responseMessage = await submitUserMessage(inputValue);
            setMessages((currentMessages) => [
              ...currentMessages,
              responseMessage,
            ]);

            setInputValue("");
          }}
        >
          <Input
            className="max-w-[75%]"
            placeholder="Send a message..."
            value={inputValue}
            onChange={(event) => {
              setInputValue(event.target.value);
            }}
          />
        </form>
      </div>
    </div>
  );
}
