import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  return (
    <div className={`prose max-w-none prose-headings:font-heading prose-headings:text-pencil prose-p:text-pencil prose-strong:text-sketch-orange prose-p:font-hand ${className}`}>
      <ReactMarkdown
        components={{
          code({ node, inline, className, children, ...props }: any) {
            return !inline ? (
              <pre className="bg-pencil text-paper p-4 rounded-sm border-2 border-pencil overflow-x-auto my-4 shadow-sketch">
                <code {...props} className={className}>
                  {children}
                </code>
              </pre>
            ) : (
              <code className="bg-sketch-yellow text-pencil px-1 py-0.5 rounded-sm border border-pencil text-sm font-hand" {...props}>
                {children}
              </code>
            );
          },
          ul({ children }) {
            return <ul className="list-disc pl-5 my-2 space-y-1 marker:text-pencil">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 my-2 space-y-1 marker:text-pencil font-bold">{children}</ol>;
          },
          blockquote({ children }) {
            return <blockquote className="border-l-4 border-sketch-blue pl-4 italic text-pencil my-4 bg-sketch-blue/10 py-2 rounded-r-sm font-hand">{children}</blockquote>
          }
        } as any}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
