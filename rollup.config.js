import babel from "rollup-plugin-babel";
import commonjs from "rollup-plugin-commonjs";
import resolve from "rollup-plugin-node-resolve";
import replace from "rollup-plugin-replace";
import { terser } from "rollup-plugin-terser";
import sourcemaps from 'rollup-plugin-sourcemaps';
import builtins from "rollup-plugin-node-builtins";
import globals from "rollup-plugin-node-globals";
import json from "rollup-plugin-json";
import gzipPlugin from "rollup-plugin-gzip";
import brotli from "rollup-plugin-brotli";
import { version } from "./package.json";

let distFileName = ''
switch (process.env.ENV) {
  case "prod":
    switch (process.env.ENC) {
      case "gzip":
        if(process.env.PROD_DEBUG == "true") {
          distFileName = "dist/rudder-analytics-map.min.gzip.js"
        } else {
          distFileName = "dist/rudder-analytics.min.gzip.js"
        }
        break
      case "br":
        if(process.env.PROD_DEBUG == "true") {
          distFileName = "dist/rudder-analytics-map.min.br.js"
        } else {
          distFileName = "dist/rudder-analytics.min.br.js"
        }
        break
      default:
        if(process.env.PROD_DEBUG == "true") {
          distFileName = "dist/rudder-analytics-map.min.js"
        } else {
          distFileName = "dist/rudder-analytics.min.js"
        }
        break
    }
    break
  default:
    distFileName =  "dist/browser.js"
    break
}

let outputFiles = []
if(process.env.NPM == "true") {
  outputFiles.push({ file: "dist/bundle.js", format: "umd", name: "rudderanalytics" } )
} else {
  outputFiles.push({
    file: distFileName,        
    format: "iife",
    name: "rudderanalytics",
    sourcemap: process.env.PROD_DEBUG == 'true'? 'inline': false,
  })
}

export default {
  input: "analytics.js",
  external: ["Xmlhttprequest", "universal-analytics"],
  output: outputFiles,
  plugins: [
    sourcemaps(),
    replace({
      "process.browser": process.env.NODE_ENV == "true" ? false : true,
      "process.prod": process.env.ENV == "prod" ? true : false,
      "process.package_version": version
    }),
    resolve({
      jsnext: true,
      browser: true
    }),

    commonjs({
      include: "node_modules/**"
      /* namedExports: {
        // left-hand side can be an absolute path, a path
        // relative to the current directory, or the name
        // of a module in node_modules
        Xmlhttprequest: ["Xmlhttprequest"]
      } */
    }),

    json(),
    globals(),
    builtins(),

    babel({
      exclude: "node_modules/**"
    }),
    process.env.uglify === "true" && terser(),
    process.env.ENC === "gzip" && gzipPlugin(),
    process.env.ENC === "br" && brotli()
  ]
};
