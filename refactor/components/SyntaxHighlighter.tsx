import React from 'react';
import { HighlightedPart } from '../hooks/useSyntaxHighlight';

interface SyntaxHighlighterProps {
  parts: HighlightedPart[];
  className?: string;
}

export const SyntaxHighlighter: React.FC<SyntaxHighlighterProps> = ({
  parts,
  className = ''
}) => {
  return (
    <div className={`syntax-highlight ${className}`}>
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return <span key={index}>{part.text}</span>;
        }

        let highlightClass = '';
        switch (part.type) {
          case 'tag':
            highlightClass = 'tag-highlight';
            break;
          case 'invalid-tag':
            highlightClass = 'invalid-tag-highlight';
            break;
          case 'bold':
            highlightClass = 'bold-highlight';
            break;
          default:
            highlightClass = '';
        }

        return (
          <span key={index} className={highlightClass}>
            {part.text}
          </span>
        );
      })}
    </div>
  );
};
