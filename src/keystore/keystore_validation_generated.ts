/* eslint eslint-comments/no-unlimited-disable: "off" */
// This file was generated by /scripts/schema-validation-codegen.ts
// Do not modify this file by hand.

/* eslint-disable */
// @ts-ignore
"use strict";
export const Keystore = validate11;
const schema12 = {
  type: "object",
  properties: {
    credentials: { type: "object" },
    appIdentifier: { type: "string" },
    version: { type: "string" },
    application: { type: "string" },
  },
  required: ["application", "appIdentifier", "credentials", "version"],
};
function validate11(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data } = {}
) {
  let vErrors = null;
  let errors = 0;
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.application === undefined && (missing0 = "application")) ||
        (data.appIdentifier === undefined && (missing0 = "appIdentifier")) ||
        (data.credentials === undefined && (missing0 = "credentials")) ||
        (data.version === undefined && (missing0 = "version"))
      ) {
        validate11.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        if (data.credentials !== undefined) {
          let data0 = data.credentials;
          const _errs1 = errors;
          if (!(data0 && typeof data0 == "object" && !Array.isArray(data0))) {
            validate11.errors = [
              {
                instancePath: instancePath + "/credentials",
                schemaPath: "#/properties/credentials/type",
                keyword: "type",
                params: { type: "object" },
                message: "must be object",
              },
            ];
            return false;
          }
          var valid0 = _errs1 === errors;
        } else {
          var valid0 = true;
        }
        if (valid0) {
          if (data.appIdentifier !== undefined) {
            const _errs3 = errors;
            if (typeof data.appIdentifier !== "string") {
              validate11.errors = [
                {
                  instancePath: instancePath + "/appIdentifier",
                  schemaPath: "#/properties/appIdentifier/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                },
              ];
              return false;
            }
            var valid0 = _errs3 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.version !== undefined) {
              const _errs5 = errors;
              if (typeof data.version !== "string") {
                validate11.errors = [
                  {
                    instancePath: instancePath + "/version",
                    schemaPath: "#/properties/version/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  },
                ];
                return false;
              }
              var valid0 = _errs5 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.application !== undefined) {
                const _errs7 = errors;
                if (typeof data.application !== "string") {
                  validate11.errors = [
                    {
                      instancePath: instancePath + "/application",
                      schemaPath: "#/properties/application/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
                var valid0 = _errs7 === errors;
              } else {
                var valid0 = true;
              }
            }
          }
        }
      }
    } else {
      validate11.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate11.errors = vErrors;
  return errors === 0;
}