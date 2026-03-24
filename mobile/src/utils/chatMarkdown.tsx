import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type InlineToken = { text: string; bold?: boolean; italic?: boolean };

export const parseInlineMarkdown = (raw: string): InlineToken[] => {
  const source = String(raw || '');
  if (!source) return [{ text: '' }];

  const pattern = /(\*\*[^*]+\*\*|\*[^*\n]+\*)/g;
  const parts = source.split(pattern).filter(Boolean);

  return parts.map((part) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return { text: part.slice(2, -2), bold: true };
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 3) {
      return { text: part.slice(1, -1), italic: true };
    }
    return { text: part };
  });
};

type BlockToken = { type: 'bullet' | 'text'; content: string };

export const parseBlockMarkdown = (raw: string): BlockToken[] => {
  const lines = String(raw || '').split('\n');
  return lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') && trimmed.length > 2) {
      return { type: 'bullet' as const, content: trimmed.slice(2).trim() };
    }
    return { type: 'text' as const, content: line };
  });
};

/** Gras ** **, italique *, listes « - » (bulles assistant Yukpo IA). */
export const FormattedChatText: React.FC<{ text: string; baseStyle: object }> = ({ text, baseStyle }) => {
  const blocks = parseBlockMarkdown(text);
  return (
    <View>
      {blocks.map((block, i) => {
        const key = `blk-${i}`;
        const tokens = parseInlineMarkdown(block.type === 'bullet' ? block.content : block.content);
        const nodes = tokens.map((t, j) => (
          <Text
            key={j}
            style={
              t.bold
                ? styles.bold
                : t.italic
                  ? styles.italic
                  : undefined
            }
          >
            {t.text}
          </Text>
        ));
        if (block.type === 'bullet') {
          return (
            <Text key={key} style={[baseStyle, { marginBottom: 6 }]}>
              <Text>{'\u2022 '}</Text>
              {nodes}
            </Text>
          );
        }
        return (
          <Text key={key} style={[baseStyle, { marginBottom: 4 }]}>
            {nodes}
          </Text>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
});
