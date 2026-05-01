import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

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
      style={[styles.chip, selected && styles.selected]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: "#C9BFAE",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
  },
  selected: {
    borderColor: "#176B5B",
    backgroundColor: "#DDEFE9",
  },
  label: {
    color: "#31413B",
    fontWeight: "700",
  },
  selectedLabel: {
    color: "#176B5B",
  },
});
