/**
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 *
 * Extends root monorepo prettier config and adds tailwindcss plugin
 */
import rootConfig from '../../.prettierrc.js';

const config = {
  ...rootConfig,
  plugins: [...(rootConfig.plugins ?? []), 'prettier-plugin-tailwindcss'],
};

export default config;
