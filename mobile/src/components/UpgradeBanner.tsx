import * as React from "react";
import { StyleSheet, Text, View } from 'react-native';

const UpgradeBanner: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>UpgradeBanner</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  text: {
    fontSize: 16,
    color: '#1F2937',
  },
});

export default UpgradeBanner;





