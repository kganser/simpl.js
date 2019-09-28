simpl.add('webapp', function() {
  return function() {
    var self, routes = [];
    
    /** webapp: function -> Router */
    /** Router: {
      request: function(path: Path, handler: RequestCallback, method=null: String, options=null: RouteOptions),
      get: function(path: Path, handler: RequestCallback, options=null: RouteOptions),
      post: function(path: Path, handler: RequestCallback, options=null: RouteOptions),
      put: function(path: Path, handler: RequestCallback, options=null: RouteOptions),
      delete: function(path: Path, handler: RequestCallback, options=null: RouteOptions),
      route: function(request: Request, response: Response) -> function|true|undefined,
      url: function(name: String, args=null: Object, options=null: UrlOptions) -> string,
      paths: object
    }
    
    Web application router and utilities. `get`, `post`, `put`, and `delete` are convenience methods for
    associating URL endpoints (via `request`) with a request handler and options. `route` will forward a request
    to the associated endpoint using the request object's method and path, returning any function returned from its
    `handler`, or `true` if otherwise matched to an endpoint.
    
    If an endpoint is named and has a string path, `url` will return its url given its `name` and `args`. If a value in
    `args` corresponds to a path segment, it is substituted there; otherwise, it is appended as a query string argument
    unless undefined (and null values append only their key to the query string).
    
    `paths` is an object mapping names to path strings for use by `url` and populated internally by `request`. It is
    accessible for serialization here, and can be passed in with `url`'s `options` in different contexts. */
    
    /** Path: string|RegExp|[string|RegExp, ...]
    
    String paths should be used where possible to enable `url` construction. Parameters within string paths are
    alphabetic identifiers starting with `:` (e.g. `/hello/:name`) and match path substrings with no `/`
    characters. The full input path must match the endpoint path to trigger its handler. */
    
    /** RouteOptions: string|[string, ...]|{
      name: string|[string, ...],
      bodyFormat=null: string,
      bodyMaxLength=null: number
    }
    
    As a string, `RouteOptions` sets the `name` of the endpoint. If `path` is an array, `name` should be an array of
    strings of the same size. If specified, `bodyFormat` (`'utf8'`, `'url'`, or `'json'`) populates `request.body` by
    parsing the incoming request before `handler` is invoked. */
    
    /** UrlOptions: {
      paths: object
    } */
    return self = {
      paths: {},
      request: function request(path, handler, method, options) {
        if (options == null) options = {};
        if (Array.isArray(path)) {
          var names = Array.isArray(options) ? options : options.name;
          if (!Array.isArray(names)) names = false;
          path.forEach(function(path, i) {
            request(path, handler, method, names ? options == names ? names[i] : Object.assign(options, {name: names[i]}) : options);
          });
        } else {
          var name = typeof options == 'string' ? options : options.name;
          if (name && typeof path == 'string') self.paths[name] = path;
          var params = typeof path == 'string' && path.match(/:[a-z]+/ig);
          if (params) {
            params = params.map(function(p) { return p.substr(1); });
            path = new RegExp('^'+path.split(/:[a-z]+/ig).map(function(s) {
              return s.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
            }).join('([^/]+)')+'$');
          }
          routes.push({
            path: path,
            handler: options.bodyFormat ? function(req, res) {
              return req.slurp(function(body) {
                handler(Object.assign(req, {body: body}), res);
              }, options.bodyFormat, options.bodyMaxLength);
            } : handler,
            method: method,
            params: params
          });
        }
      },
      get: function(path, handler, options) { self.request(path, handler, 'GET', options); },
      post: function(path, handler, options) { self.request(path, handler, 'POST', options); },
      put: function(path, handler, options) { self.request(path, handler, 'PUT', options); },
      delete: function(path, handler, options) { self.request(path, handler, 'DELETE', options); },
      route: function(request, response) {
        var value;
        return routes.some(function(route) {
          if (route.method && route.method != request.method) return;
          if (route.path instanceof RegExp) {
            var match = request.path.match(route.path);
            if (match) {
              if (!route.params) request.match = match;
              request.params = match.slice(1).reduce(function(obj, key, i) {
                var key = route.params[i],
                    val = decodeURIComponent(match[i+1]);
                if (key) obj[key] = val;
                obj[i+1] = val;
                return obj;
              }, {});
              return value = route.handler(request, response) || true;
            }
          } else if (route.path == request.path) {
            return value = route.handler(request, response) || true;
          }
        }) && value;
      },
      url: function(name, args, options) {
        if (!args) args = {};
        if (!options) options = {};
        var path = (options.paths || self.paths)[name];
        if (!path) throw new Error('URL not registered: '+name);
        return path.replace(/:[a-z]+/ig, function(param) {
          var key = param.substr(1),
              arg = args[key] || '';
          delete args[key];
          return encodeURIComponent(arg);
        }) + ('?' + Object.keys(args).reduce(function(query, name) {
          var value = args[name];
          name = encodeURIComponent(name);
          return query.concat(
            value === undefined ? []
              : Array.isArray(value) ? value.map(function(v) {
                return name+'='+encodeURIComponent(v || '');
              })
              : [name+(value == null ? '' : '='+encodeURIComponent(value))]);
        }, []).join('&')).replace(/\?$/, '');
      }
    };
  };
});