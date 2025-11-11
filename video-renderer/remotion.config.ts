import { Config } from 'remotion';

Config.Rendering.setImageFormat('jpeg');
Config.Output.setOverwriteOutput(true);
Config.Bundling.overrideWebpackConfig(() => ({
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
  }
}));


