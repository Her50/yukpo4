// @ts-check
import React from 'react';

function Loader() {
  return (
    <View style="flex items-center justify-center min-h-screen bg-black text-white">
      <View style="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 border-solid" />
    </View>
  );
}

export default Loader;

