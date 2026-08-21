import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Renders a release note.
 *
 * Styles are spelled out per element rather than coming from a typography
 * plugin: the portal doesn't carry one, and a release note only ever uses a
 * handful of tags. GFM is on for tables and task lists, which changelogs
 * written in a hurry do reach for.
 *
 * `react-markdown` does not render raw HTML unless the `rehype-raw` plugin is
 * added, and it isn't — so a note is text, never markup that could execute.
 */
export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn("text-sm leading-relaxed text-foreground", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-3 mt-6 text-lg font-semibold first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-6 text-base font-semibold first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground first:mt-0">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="my-2">{children}</p>,
          ul: ({ children }) => (
            <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          hr: () => <hr className="my-5 border-border" />,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline underline-offset-2"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8125rem]">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="my-3 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-border pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto">
              <table className="w-full text-left text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-border px-2 py-1.5 font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border/60 px-2 py-1.5">{children}</td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
