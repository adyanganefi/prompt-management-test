import React from 'react';

export const parseChatText = (text = '') => {
  const parts = text.split(/(\*\*\*.*?\*\*\*|\*\*.*?\*\*|_.*?_)/g);
  return parts.map((part, index) => {
    if (part.startsWith('***') && part.endsWith('***') && part.length > 6) {
      const boldItalicText = part.slice(3, -3);
      return React.createElement('b', { key: index, className: 'font-bold italic' }, boldItalicText);
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      const boldText = part.slice(2, -2);
      return React.createElement('b', { key: index, className: 'font-bold' }, boldText);
    }
    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
      const italicText = part.slice(1, -1);
      return React.createElement('i', { key: index, className: 'italic' }, italicText);
    }
    return React.createElement('span', { key: index }, part);
  });
};
