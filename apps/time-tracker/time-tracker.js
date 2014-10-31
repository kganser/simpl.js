kernel.use({http: 0, database: 0, html: 0, xhr: 0}, function(o) {
  o.http.serve({port: 8003}, function(request, response) {
    var match;
    if (request.method == 'DELETE' && (match = /^\/(entries\/\d{4}-\d{2}-\d{2})\/([^\/]*)$/.exec(request.path)))
      return o.database.get(match[1], function(date) {
        var issues = date && Object.keys(date);
        if (issues && issues.length > 1)
          return o.database.delete(request.path.substr(1), function() {
            response.end('Success');
          });
        if (!issues || issues[0] != decodeURIComponent(match[2]))
          return response.end('Success');
        o.database.delete(match[1], function() {
          response.end('Success');
        });
      });
    switch (request.path) {
      case '/issues':
        try {
          var credentials = atob(request.headers.Authorization.split(' ')[1] || '').split(':', 2);
        } catch (e) {
          return response.end(o.http.getStatus(401), {'WWW-Authenticate': 'Basic realm="redmine.slytrunk.com credentials"'}, 401);
        }
        return o.xhr('http://redmine.slytrunk.com/issues.json?assigned_to_id=me&status_id=*&limit=100', {
          user: credentials[0],
          password: credentials[1],
          responseType: 'json'
        }, function(e) {
          if (!e.target.response)
            return response.end(o.http.getStatus(500), null, 500);
          var issues = {};
          e.target.response.issues.forEach(function(issue) {
            issues[issue.id] = {id: issue.id, name: issue.project.name+' - '+issue.subject, url: 'http://redmine.slytrunk.com/issues/'+issue.id};
          });
          response.end(JSON.stringify(issues), {'Content-Type': 'application/json'});
        });
      case '/entries':
        switch (request.method) {
          case 'POST':
            var entry = request.json;
            if (!entry || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || typeof entry.time != 'number')
              return response.end(o.http.getStatus(400), null, 400);;
            return o.database.get('entries/'+entry.date, function(entries) {
              if (entries) return o.database.put('entries/'+entry.date+'/'+encodeURIComponent(entry.issue), entry.time, function() {
                response.end('Success');
              });
              var e = {}; e[entry.issue] = entry.time;
              o.database.put('entries/'+entry.date, e, function() {
                response.end('Success');
              });
            });
          case 'GET':
            return o.database.get('entries', function(entries) {
              response.end(JSON.stringify(entries), {'Content-Type': 'application/json'});
            });
        }
        return response.end(o.http.getStatus(501), null, 501);
      case '/':
        return response.end(o.html.markup({html: [
          {head: [
            {title: 'Time Tracker'},
            {meta: {charset: 'utf-8'}},
            {meta: {name: 'viewport', content: 'width=device-width, initial-scale=1.0, user-scalable=no'}},
            {link: {rel: 'stylesheet', href: 'http://localhost:8001/apps/time-tracker/time-tracker.css'}}
          ]},
          {body: [
            {script: {src: 'http://localhost:8001/kernel.js'}},
            {script: {src: 'http://localhost:8001/modules/html.js'}},
            {script: {src: 'http://localhost:8001/modules/xhr.js'}},
            {script: {src: 'http://localhost:8001/modules/async.js'}},
            {script: function() {
              kernel.use({html: 0, xhr: 0, async: 0}, function(o) {
                var issues = {}, issue, hours, dates, entries, add, form, suggest, previous, report,
                    days = 'Sun Mon Tues Wed Thurs Fri Sat'.split(' '),
                    months = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' '),
                    today = new Date(), now = Date.now();
                var dateString = function(d) {
                  var y = d.getFullYear(),
                      m = d.getMonth()+1,
                      d = d.getDate();
                  return y+'-'+(m < 10 ? '0'+m : m)+'-'+(d < 10 ? '0'+d : d);
                };
                var dateIcon = function(date, click) {
                  return {div: {className: 'date'+(date.getDay() in {0:1,6:1} ? ' weekend' : ''), onclick: click, children: [
                    {div: days[date.getDay()]},
                    months[date.getMonth()]+' '+date.getDate()
                  ]}};
                };
                o.async.join(
                  function(callback) {
                    o.xhr('/entries', {responseType: 'json'}, function(e) {
                      callback(e.target.response);
                    });
                  },
                  function(callback) {
                    o.xhr('/issues', {responseType: 'json'}, function(e) {
                      callback(issues = e.target.response);
                    });
                  },
                  function(data) {
                    dates = data;
                    var page = 0;
                    previous.textContent = 'Previous';
                    previous.disabled = add.disabled = false;
                    (previous.onclick = function() {
                      new Array(15).join(' ').split('').forEach(function(x, i) {
                        var date = dateString(new Date(now-(page*14+i)*24*60*60*1000));
                        entries.insert(o.html.model(dates[date] || {}, function(hours, issue, index, items) {
                          return {li: [
                            {button: {className: 'remove', children: '?', onclick: function(e) {
                              this.disabled = true;
                              o.xhr('/entries/'+date+'/'+encodeURIComponent(issue), {method: 'DELETE'}, function() {
                                items.remove(issue);
                                delete dates[date][issue];
                              });
                            }}},
                            {div: {className: 'time', children: hours+' h'}},
                            {div: {className: 'name', children: issues[issue] ? issues[issue].name : issue}}
                          ]};
                        }), date);
                      });
                      page++;
                    })();
                  }
                );
                o.html.dom([
                  {header: [
                    {nav: [
                      {span: {children: 'Record', onclick: function() { document.body.className = ''; }}},
                      {span: {children: 'Report', onclick: function() { document.body.className = 'show-report'; }}}
                    ]},
                    {div: {className: 'record', children: function(e) {
                      form = e;
                      return [
                        dateIcon(today),
                        {div: {className: 'issue', children: [
                          {input: {type: 'text', placeholder: 'issue', onkeyup: function(e) {
                            issue = this.value;
                            var items = issue.length < 2 ? [] : Object.keys(issues).map(function(id) {
                              return [id, issues[id]];
                            }).filter(function(item) {
                              return ~(item[1].id+item[1].name.toLowerCase()).indexOf(issue.toLowerCase());
                            });
                            o.html.dom(items.map(function(item) {
                              return {li: {children: item[1].name, onclick: function() {
                                issue = item[0];
                                e.target.value = item[1].name;
                                o.html.dom(null, suggest, true);
                                hours.focus();
                              }}};
                            }), suggest, true);
                          }, onfocus: function() {
                            suggest.style.display = 'block';
                          }, onblur: function() {
                            setTimeout(function() {
                              suggest.style.display = 'none'; // TODO: more elegant solution?
                            }, 500);
                          }}},
                          {ul: function(e) { suggest = e; }}
                        ]}},
                        {input: {type: 'text', className: 'hours', placeholder: 'hours', children: function(e) { hours = e; }}},
                        {button: {children: function(e) { add = e; return 'Add'; }, disabled: true, onclick: function(e) {
                          this.disabled = true;
                          var entry,
                              date = dateString(today),
                              time = parseFloat(hours.value);
                          if (!time || time < 0) {
                            alert('Invalid number of hours');
                          } else {
                            o.xhr('/entries', {
                              method: 'POST',
                              data: JSON.stringify({date: date, time: time, issue: issue}),
                              headers: {'Content-Type': 'application/json'}
                            }, function() {
                              e.target.disabled = false;
                              entries.get(date).insert(time, issue);
                              if (!dates[date]) dates[date] = {};
                              dates[date][issue] = time;
                            });
                          }
                        }}}
                      ];
                    }}},
                    {div: {className: 'report', children: [
                      {ul: function() {
                        var span = {};
                        return new Array(23 + new Date(now).getDay()).join(' ').split('').map(function(x, i, days) {
                          var date = new Date(now-(days.length-i-1)*24*60*60*1000),
                              value = dateString(date);
                          return {li: [dateIcon(date, function() {
                            if (this.classList.contains('selected')) delete span[value];
                            else span[value] = dates[value] || {};
                            this.classList.toggle('selected');
                            var totals = {}, total = 0;
                            Object.keys(span).forEach(function(date) {
                              Object.keys(date = span[date]).forEach(function(issue) {
                                totals[issue] = (totals[issue] || 0) + date[issue];
                              });
                            });
                            o.html.dom({ul: Object.keys(totals).concat([1]).map(function(issue, i, arr) {
                              var last = i == arr.length-1;
                              if (!last) total += totals[issue];
                              return {li: {className: last ? 'total' : '', children: [
                                {div: {className: 'time', children: (last ? total : totals[issue])+' h'}},
                                {div: {className: 'name', children: last ? 'Total' : issues[issue].name}}
                              ]}};
                            })}, report, true);
                          })]};
                        });
                      }}
                    ]}}
                  ]},
                  {div: {className: 'content', children: [
                    {div: {className: 'record', children: [
                      {ul: (entries = o.html.model({}, function(value, date) {
                        date = date.split('-');
                        date = new Date(date[0], parseInt(date[1], 10)-1, parseInt(date[2], 10));
                        return {li: [
                          dateIcon(date, function() {
                            form.replaceChild(o.html.dom(dateIcon(today = date)), form.firstChild);
                          }),
                          {ul: value.view}
                        ]};
                      })).view},
                      {button: {className: 'previous', children: function(e) { previous = e; return 'Loading...'; }, disabled: true}}
                    ]}},
                    {div: {className: 'report', children: function(e) { report = e; }}}
                  ]}}
                ], document.body);
              });
            }}
          ]}
        ]}), {'Content-Type': 'text/html'});
    }
    response.end('404 Resource not found', null, 404);
  });
});
