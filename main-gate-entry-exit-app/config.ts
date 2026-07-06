import apiConfig from "./apiConfig.json";

const API_BASE = __DEV__
  ? apiConfig.LOCAL_API
  : apiConfig.PRODUCTION_API;

export default API_BASE;