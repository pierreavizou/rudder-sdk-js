import logger from "../../utils/logUtil";
import { ScriptLoader } from "../ScriptLoader";
import {
  MAX_WAIT_FOR_INTEGRATION_LOAD,
  INTEGRATION_LOAD_CHECK_INTERVAL
} from "../../utils/constants";

class Bugsnag {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.name = "BUGSNAG";
    this.setIntervalHandler = undefined;
    logger.debug("Config ", config);
  }

  init() {
    logger.debug("===in init Bugsnag===");
    ScriptLoader(
      "bugsnag-id",
      "//d2wy8f7a9ursnm.cloudfront.net/v6/bugsnag.min.js"
    );

    this.setIntervalHandler = setInterval(
      this.initBugsnagClient.bind(this),
      1000
    );
  }

  initBugsnagClient() {
    if (window.bugsnag !== undefined && window.bugsnag !== void 0) {
      window.bugsnagClient = window.bugsnag(this.apiKey);
      clearInterval(this.setIntervalHandler);
    }
  }

  isLoaded() {
    logger.debug("in bugsnag isLoaded");
    return !!window.bugsnagClient;
  }

  isReady() {
    logger.debug("in bugsnag isReady");
    return !!window.bugsnagClient;
  }

  identify(rudderElement) {
    let traits = rudderElement.message.context.traits;
    let traitsFinal = {
      id: rudderElement.message.userId,
      name: traits.name,
      email: traits.email
    };
    console.log(traitsFinal);
    window.bugsnagClient.user = traitsFinal;
  }
}
export { Bugsnag };