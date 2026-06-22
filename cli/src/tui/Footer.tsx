import { Box, Text } from "ink";

interface FooterProps {
  readonly showHistory: boolean;
  readonly hasPending: boolean;
}

export function Footer({ showHistory, hasPending }: FooterProps) {
  return (
    <Box flexDirection="column">
      <Box paddingX={1} paddingY={0}>
        {hasPending && (
          <>
            <Text dimColor>↑↓ navigate  </Text>
            <Text color="#DB0028">enter</Text>
            <Text dimColor> approve  </Text>
            <Text color="#DB0028">d</Text>
            <Text dimColor> deny  </Text>
            <Text dimColor>e expand  </Text>
          </>
        )}
        <Text dimColor>h {showHistory ? "hide history" : "history"}  </Text>
        <Text dimColor>q quit</Text>
      </Box>
    </Box>
  );
}
