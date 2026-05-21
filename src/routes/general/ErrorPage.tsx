import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { FC } from "hono/jsx";

export interface ErrorPageProps {
  statusCode: number;
  heading: string;
  message: string;
  errorStack?: string | null;
}

export const ErrorPage: FC<ErrorPageProps> = ({ statusCode, heading, message, errorStack }) => (
  <div class="mx-auto max-w-md px-4 text-center">
    <div class="flex flex-col gap-4">
      <h1 class="fade-in-heading text-6xl font-bold text-power">{statusCode}</h1>
      <p class="fade-in animation-delay-2 text-xl text-white">{heading}</p>
      <p class="fade-in animation-delay-3 text-neutral-500">{message}</p>
      {errorStack && (
        <pre class="fade-in animation-delay-4 mt-4 overflow-scroll rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-left text-xs text-neutral-400">
          {errorStack}
        </pre>
      )}
      <div class="fade-in animation-delay-4 mt-4">
        <a
          href="/"
          class="inline-block rounded-md bg-power px-4 py-2 font-medium text-white transition-all hover:bg-power-dark"
        >
          Back to home
        </a>
      </div>
    </div>
  </div>
);

export function renderErrorPage(c: Context, props: ErrorPageProps) {
  c.status(props.statusCode as ContentfulStatusCode);
  return c.render(<ErrorPage {...props} />, { title: props.heading });
}
