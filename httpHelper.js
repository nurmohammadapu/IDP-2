const http = require("http");
const url = require("url");
const path = require("path");
const os = require("os");
const fs = require("fs");

function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(";").forEach((cookie) => {
    let [name, ...rest] = cookie.split("=");
    name = name?.trim();
    if (!name) return;
    const value = rest.join("=").trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
}

async function runMiddlewareChain(req, res, handlers) {
  let index = 0;
  async function next(err) {
    if (err) {
      console.error("Handler Error:", err);
      if (!res.writableEnded) {
        return res.status(500).json({ success: false, message: "Internal Server Error" });
      }
      return;
    }
    if (index < handlers.length && !res.writableEnded) {
      const handler = handlers[index++];
      try {
        await handler(req, res, next);
      } catch (error) {
        next(error);
      }
    }
  }
  await next();
}

// 💡 Accurate Dynamic Path Matching (:id, :status, etc.)
function matchPath(routePath, requestPath) {
  const routeSegments = routePath.split("/").filter(Boolean);
  const requestSegments = requestPath.split("/").filter(Boolean);

  if (routeSegments.length !== requestSegments.length) {
    return null;
  }

  const params = {};
  for (let i = 0; i < routeSegments.length; i++) {
    const routeSeg = routeSegments[i];
    const reqSeg = requestSegments[i];

    if (routeSeg.startsWith(":")) {
      params[routeSeg.slice(1)] = decodeURIComponent(reqSeg);
    } else if (routeSeg !== reqSeg) {
      return null;
    }
  }

  return params;
}

// Router Component
function createRouter() {
  const routes = [];

  return {
    isRouter: true,
    get: function (path, ...handlers) { routes.push({ method: "GET", path, handlers }); },
    post: function (path, ...handlers) { routes.push({ method: "POST", path, handlers }); },
    put: function (path, ...handlers) { routes.push({ method: "PUT", path, handlers }); },
    delete: function (path, ...handlers) { routes.push({ method: "DELETE", path, handlers }); },
    patch: function (path, ...handlers) { routes.push({ method: "PATCH", path, handlers }); },

    handle: async function (req, res, subPath) {
      const method = req.method.toUpperCase();

      for (const route of routes) {
        if (route.method === method) {
          const params = matchPath(route.path, subPath);
          if (params) {
            req.params = { ...(req.params || {}), ...params };
            await runMiddlewareChain(req, res, route.handlers);
            return true;
          }
        }
      }
      return false;
    }
  };
}

function createHttpApp() {
  const middlewares = [];
  const routes = [];

  const app = {
    use: function (...args) {
      if (args.length === 1) {
        middlewares.push(args[0]);
      } else if (args.length === 2) {
        const [prefix, routerOrMiddleware] = args;
        routes.push({ prefix, handler: routerOrMiddleware });
      }
    },

    get: function (path, ...handlers) { routes.push({ prefix: path, method: "GET", handlers }); },
    post: function (path, ...handlers) { routes.push({ prefix: path, method: "POST", handlers }); },
    put: function (path, ...handlers) { routes.push({ prefix: path, method: "PUT", handlers }); },
    delete: function (path, ...handlers) { routes.push({ prefix: path, method: "DELETE", handlers }); },
    patch: function (path, ...handlers) { routes.push({ prefix: path, method: "PATCH", handlers }); },

    listen: function (port, callback) {
      const server = http.createServer(async (req, res) => {
        
        // 1. Request Utility Bindings
        req.header = req.get = function (name) {
          if (!name) return undefined;
          const lc = name.toLowerCase();
          if (lc === 'referer' || lc === 'referrer') {
            return req.headers['referrer'] || req.headers['referer'];
          }
          return req.headers[lc];
        };

        req.cookies = parseCookies(req.headers.cookie);
        req.params = {};

        // 2. Response Utility Bindings
        res.status = function (code) {
          res.statusCode = code;
          return res;
        };

        res.json = function (data) {
          if (res.writableEnded) return;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(data));
        };

        res.send = function (body) {
          if (res.writableEnded) return;
          if (typeof body === 'object') {
            return res.json(body);
          }
          res.setHeader("Content-Type", "text/html");
          res.end(body);
        };

        res.cookie = function (name, value, options = {}) {
          let cookieString = `${name}=${encodeURIComponent(value)}`;

          if (options.expires) cookieString += `; Expires=${options.expires.toUTCString()}`;
          if (options.maxAge) cookieString += `; Max-Age=${Math.floor(options.maxAge / 1000)}`;
          if (options.domain) cookieString += `; Domain=${options.domain}`;
          if (options.path) cookieString += `; Path=${options.path}`;
          if (options.secure) cookieString += `; Secure`;
          if (options.httpOnly) cookieString += `; HttpOnly`;
          if (options.sameSite) cookieString += `; SameSite=${options.sameSite}`;

          const existing = res.getHeader("Set-Cookie");
          if (existing) {
            if (Array.isArray(existing)) {
              res.setHeader("Set-Cookie", [...existing, cookieString]);
            } else {
              res.setHeader("Set-Cookie", [existing, cookieString]);
            }
          } else {
            res.setHeader("Set-Cookie", cookieString);
          }

          return res;
        };

        res.clearCookie = function (name, options = {}) {
          return res.cookie(name, "", {
            ...options,
            expires: new Date(0),
            maxAge: 0,
          });
        };

        // 3. Request Body Parsing
        const contentType = req.headers["content-type"] || "";

        if (contentType.includes("multipart/form-data")) {
          req.body = {};
          req.files = {};

          await new Promise((resolve) => {
            try {
              const Busboy = require("busboy");
              const busboy = Busboy({ headers: req.headers });

              busboy.on("field", (fieldname, val) => {
                req.body[fieldname] = val;
              });

              busboy.on("file", (fieldname, file, info) => {
                const { filename, mimeType } = info;
                const saveTo = path.join(os.tmpdir(), `${Date.now()}-${filename}`);
                const writeStream = fs.createWriteStream(saveTo);

                file.pipe(writeStream);

                req.files[fieldname] = {
                  name: filename,
                  tempFilePath: saveTo,
                  mimetype: mimeType,
                  size: 0,
                };
              });

              busboy.on("finish", () => resolve());
              req.pipe(busboy);
            } catch (err) {
              console.error("Multipart parsing error:", err);
              resolve();
            }
          });
        } else {
          let bodyData = "";
          await new Promise((resolve) => {
            req.on("data", (chunk) => (bodyData += chunk.toString()));
            req.on("end", () => {
              try {
                req.body = bodyData ? JSON.parse(bodyData) : {};
              } catch {
                req.body = {};
              }
              resolve();
            });
          });
        }

        const parsedUrl = url.parse(req.url, true);
        const reqPath = parsedUrl.pathname;
        req.query = parsedUrl.query;

        // 4. Middlewares
        for (const middleware of middlewares) {
          if (typeof middleware === "function") {
            if (res.writableEnded) break;
            await new Promise((resolve) => {
              let resolved = false;
              const safeResolve = () => {
                if (!resolved) {
                  resolved = true;
                  resolve();
                }
              };
              res.on("finish", safeResolve);
              res.on("close", safeResolve);
              try {
                middleware(req, res, safeResolve);
              } catch (error) {
                console.error("Middleware error:", error);
                safeResolve();
              }
            });
          }
        }

        if (res.writableEnded) return;

        // 5. Routing Execution
        let handled = false;
        const method = req.method.toUpperCase();

        for (const route of routes) {
          // Direct app level route
          if (route.method && route.method === method) {
            const params = matchPath(route.prefix, reqPath);
            if (params) {
              req.params = { ...req.params, ...params };
              await runMiddlewareChain(req, res, route.handlers);
              handled = true;
              break;
            }
          }

          // Router mounted via app.use('/prefix', router)
          if (!route.method && reqPath.startsWith(route.prefix)) {
            let subPath = reqPath.slice(route.prefix.length);
            if (!subPath.startsWith("/")) {
              subPath = "/" + subPath;
            }

            if (route.handler && route.handler.isRouter) {
              handled = await route.handler.handle(req, res, subPath);
              if (handled) break;
            }
          }
        }

        if (!handled && !res.writableEnded) {
          res.status(404).json({ success: false, message: "Route Not Found" });
        }
      });

      return server.listen(port, callback);
    },
  };

  return app;
}

createHttpApp.Router = function () {
  return createRouter();
};

createHttpApp.json = function () {
  return (req, res, next) => {
    if (typeof next === "function") next();
  };
};

module.exports = createHttpApp;