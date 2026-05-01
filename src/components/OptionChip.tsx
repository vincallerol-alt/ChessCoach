import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius } from "../design/theme";

interface OptionChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function OptionChip({ label, selected, onPress }: OptionChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  selected: {
    borderColor: colors.green,
    backgroundColor: colors.mint,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  label: {
    color: "#31413B",
    fontWeight: "700",
  },
  selectedLabel: {
    color: colors.green,
  },
});
