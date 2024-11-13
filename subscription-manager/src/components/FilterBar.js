import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

const labels = ["Entertainment", "Internet", "Shopping"];

const FilterBar = ({ onFilter }) => {
  const [selectedLabel, setSelectedLabel] = useState(null);

  const handleSelectLabel = (label) => {
    setSelectedLabel(label === selectedLabel ? null : label);
    onFilter(label === selectedLabel ? null : label);
  };

  return (
    <View style={styles.container}>
      {labels.map((label) => (
        <TouchableOpacity
          key={label}
          style={[
            styles.label,
            selectedLabel === label && styles.selectedLabel,
          ]}
          onPress={() => handleSelectLabel(label)}
        >
          <Text style={styles.labelText}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginBottom: 16,
  },
  label: {
    padding: 10,
    backgroundColor: "#ccc",
    borderRadius: 8,
    marginRight: 8,
  },
  selectedLabel: {
    backgroundColor: "#007bff",
  },
  labelText: {
    color: "#fff",
  },
});

export default FilterBar;
