import { Box, Text } from "ink";

interface FooterProps {
  readonly showHistory: boolean;
  readonly hasPending: boolean;
}

export function Footer({ showHistory, hasPending }: FooterProps) {
  return (
    <Box borderStyle="single" paddingX={1}>
      {hasPending && (
        <>
          <Text dimColor>↑↓ navigate  </Text>
          <Text color="green">enter</Text>
          <Text dimColor> approve  </Text>
          <Text color="red">d</Text>
          <Text dimColor> deny  </Text>
          <Text dimColor>e expand  </Text>
        </>
      )}
      <Text dimColor>h </Text>
      <Text dimColor>{showHistory ? "hide history" : "history"}</Text>
      <Text dimColor>  q quit</Text>
    </Box>
  );
}
