import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  return (
    <div className={`prose prose-slate max-w-none prose-headings:font-serif prose-headings:text-slate-800 prose-p:text-slate-700 prose-strong:text-indigo-700 ${className}`}>
      <ReactMarkdown
        components={{
          code({ node, inline, className, children, ...props }: any) {
            return !inline ? (
              <pre className="bg-slate-800 text-slate-100 p-4 rounded-md overflow-x-auto my-4">
                <code {...props} className={className}>
                  {children}
                </code>
              </pre>
            ) : (
              <code className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded text-sm font-mono" {...props}>
                {children}
              </code>
            );
          },
          ul({ children }) {
            return <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>;
          },
          blockquote({ children }) {
            return <blockquote className="border-l-4 border-indigo-400 pl-4 italic text-slate-600 my-4 bg-slate-50 py-2 rounded-r">{children}</blockquote>
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
