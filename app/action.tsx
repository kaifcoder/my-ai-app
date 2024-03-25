import { OpenAI } from "openai";
import { createAI, getMutableAIState, render } from "ai/rsc";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SunIcon } from "lucide-react";
import axios from "axios";
import { Skeleton } from "@/components/ui/skeleton";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// An example of a spinner component. You can also import your own components,
// or 3rd party component libraries.
function Spinner() {
  return (
    <div className="flex items-center space-x-4">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-[250px]" />
        <Skeleton className="h-4 w-[200px]" />
      </div>
    </div>
  );
}

// An example of a flight card component.
function FlightCard({ flightInfo }: any) {
  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Flight Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 items-start gap-4 text-sm">
          <div>
            <p>Flight Number</p>
            <p className="text-lg font-semibold">{flightInfo.flightNumber}</p>
          </div>
          <div className="text-right">
            <p>Departure</p>
            <p className="text-lg font-semibold">{flightInfo.departure}</p>
          </div>
          <div>
            <p>Arrival</p>
            <p className="text-lg font-semibold">{flightInfo.arrival}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WeatherCard({ weatherInfo }: any) {
  return (
    <div>
      <Card className="w-full max-w-xs">
        <CardHeader className="p-4">
          <SunIcon className="w-12 h-12" />
        </CardHeader>
        <CardContent className="p-4 flex flex-col items-center justify-center gap-2">
          <CardTitle>{weatherInfo.city}</CardTitle>
          <div className="text-3xl font-bold leading-none">
            {weatherInfo.temperature}
            <span className="text-base font-normal">°C</span>
          </div>
          <div className="text-sm font-medium">{weatherInfo.conditions}</div>
        </CardContent>
      </Card>
    </div>
  );
}

// An example of a function that fetches flight information from an external API.
async function getFlightInfo(flightNumber: string) {
  return {
    flightNumber,
    departure: "New York",
    arrival: "San Francisco",
  };
}

async function getWeatherInfo(city: string) {
  const options = {
    method: "GET",
    url: "https://open-weather13.p.rapidapi.com/city/" + city,
    headers: {
      "X-RapidAPI-Key": "782f442b41msh8383ee5761cbc6ap10e0f9jsn210af840c813",
      "X-RapidAPI-Host": "open-weather13.p.rapidapi.com",
    },
  };

  try {
    const response = await axios.request(options);
    console.log(response.data);
    // convert farhenheit to celsius
    const temperature = (response.data.main.temp - 32) * (5 / 9);
    return {
      city,
      temperature: temperature.toFixed(2),
      conditions: response.data.weather[0].main,
    };
  } catch (error) {
    console.error(error);
  }
}

async function submitUserMessage(userInput: string) {
  "use server";

  const aiState = getMutableAIState<typeof AI>();

  // Update the AI state with the new user message.
  aiState.update([
    ...aiState.get(),
    {
      role: "user",
      content: userInput,
    },
  ]);

  // The `render()` creates a generated, streamable UI.
  const ui: any = render({
    model: "gpt-3.5-turbo-0613",
    provider: openai,
    messages: [
      { role: "system", content: "You are a weather assistant" },
      ...aiState.get(),
    ],
    // `text` is called when an AI returns a text response (as opposed to a tool call).
    // Its content is streamed from the LLM, so this function will be called
    // multiple times with `content` being incremental.
    text: ({ content, done }) => {
      // When it's the final content, mark the state as done and ready for the client to access.
      if (done) {
        aiState.done([
          ...aiState.get(),
          {
            role: "assistant",
            content,
          },
        ]);
      }

      return <p>{content}</p>;
    },
    tools: {
      get_flight_info: {
        description: "Get the information for a flight",
        parameters: z
          .object({
            flightNumber: z.string().describe("the number of the flight"),
          })
          .required(),
        render: async function* ({ flightNumber }) {
          // Show a spinner on the client while we wait for the response.
          yield <Spinner />;

          // Fetch the flight information from an external API.
          const flightInfo = await getFlightInfo(flightNumber);

          // Update the final AI state.
          aiState.done([
            ...aiState.get(),
            {
              role: "function",
              name: "get_flight_info",
              // Content can be any string to provide context to the LLM in the rest of the conversation.
              content: JSON.stringify(flightInfo),
            },
          ]);

          // Return the flight card to the client.
          return <FlightCard flightInfo={flightInfo} />;
        },
      },
      get_werather_info: {
        description: "Get the weather information for a city",
        parameters: z
          .object({
            city: z.string().describe("the city to get the weather for"),
          })
          .required(),
        render: async function* ({ city }) {
          // Show a spinner on the client while we wait for the response.
          yield <Spinner />;

          // Fetch the weather information from an external API.
          const weatherInfo = await getWeatherInfo(city);

          // Update the final AI state.
          aiState.done([
            ...aiState.get(),
            {
              role: "function",
              name: "get_weather_info",
              // Content can be any string to provide context to the LLM in the rest of the conversation.
              content: JSON.stringify(weatherInfo),
            },
          ]);

          // Return the weather card to the client.
          return <WeatherCard weatherInfo={weatherInfo} />;
        },
      },
    },
  });

  return {
    id: Date.now(),
    display: ui,
  };
}

// Define the initial state of the AI. It can be any JSON object.
const initialAIState: {
  role: "user" | "assistant" | "system" | "function";
  content: string;
  id?: string;
  name?: string;
}[] = [];

// The initial UI state that the client will keep track of, which contains the message IDs and their UI nodes.
const initialUIState: {
  id: number;
  display: React.ReactNode;
}[] = [];

// AI is a provider you wrap your application with so you can access AI and UI state in your components.
export const AI = createAI({
  actions: {
    submitUserMessage,
  },
  // Each state can be any shape of object, but for chat applications
  // it makes sense to have an array of messages. Or you may prefer something like { id: number, messages: Message[] }
  initialUIState,
  initialAIState,
});
