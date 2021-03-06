'use strict'

// Disclaimer: this code is quite messy, and will need a rewrite sometime
// read at your own risk ;)

const React = require('react')
const ReactDOM = require('react-dom')
const create = require('create-react-class')
const Promise = require('bluebird')
const rfetch = require('fetch-retry')
const urllib = require('url')

const icons = require('./icons.js')

let apiUrl = urllib.parse("https://neo.lain.haus/api/report")
let options = {retries: 5, retryDelay: 200}

let App = create({
  displayName: "App",

  getInitialState: function() {
    return({
      json: undefined
    })
  },

  componentDidMount: function() {
    setTimeout(() => {
      if (window.location.hash) {
        var hash = window.location.hash.substring(1)
        this.state.ref.value = hash
        this.submit()
      }
    }, 100)
  },

  setRef: function(e) {
    if (e == null) {
      return
    }
    e.addEventListener('keydown', (e) => {
      if (e.keyCode == 13) {
        this.submit()
      }
    })
    e.focus()
    this.setState({
      ref: e
    })
  },

  submit: function() {
    let url = Object.assign(apiUrl, {
      query: {
        server_name: this.state.ref.value.toLowerCase()
      }
    })

    this.setState({
      loading: true,
      json: undefined
    })

    console.log("Querying API", urllib.format(url))
    rfetch(urllib.format(url), options)
      .then((res) => res.json())
      .then((json) => {
        // The tldr block will be displayed before the full table
        let tldr = []
        Object.keys(json.ConnectionReports).forEach((ip) => {
          let report = json.ConnectionReports[ip]
          if (!report.ValidCertificates) {
            tldr.push(<div className="warning" key={`cert-${tldr.length}`}>
              WARN: Self-signed cert found for {ip}, this will need to be replaced in the future <a href="https://github.com/matrix-org/matrix-doc/pull/1711">MSC1711</a>
            </div>)
          }

          Object.keys(report.Info).forEach((infoKey) => {
            let bool = report.Info[infoKey]
            if (!bool) {
              tldr.push(<div className="info" key={`cert-${tldr.length}`}>
                INFO: No {infoKey} for {ip}
              </div>)
            }
          })

          recursiveCheck(report.Checks, "Checks", (path) => {
            // Found an error
            tldr.push(<div className="error" key={`${path}-${tldr.length}`}>
              ERROR: on {ip}: {path} failed
            </div>)
          })
        })
        this.setState({
          json: json,
          tldr: tldr,
          loading: false
        })
      })
  },

  render: function() {
    let result
    let errors
    let active = ""

    if (this.state.loading) {
      active = " active";
    }

    if (this.state.json != undefined) {
      let reportCount = Object.keys(this.state.json.ConnectionReports).length
      if (reportCount == 0) {
        errors = (
          <div className="error">
            No connection reports, is this even a matrix server?
          </div>
        )
      } else {
        result = <>
          Got {reportCount} connection report{reportCount > 1 && <>s</>}

          <div className="tldr">
            {this.state.tldr}
          </div>
          <TestResults json={this.state.json}/>
        </>
      }
    }

    return (
      <div className="block">
        <div className="text">
          <span id="jok">unlike the name suggests, this won't help you find three letter agencies :p</span><br/>
          However, it might help you debug your Matrix instance<br/><br/>
          Made with love by <a href="https://f.0x52.eu">f0x</a>, sourcecode <a href="https://git.lain.haus/f0x/fed-tester">here</a>, powered by the <a href="https://github.com/matrix-org/matrix-federation-tester">matrix-federation-tester</a> backend <br/>
      <a href="https://liberapay.com/f0x/donate"><img alt="Donate using Liberapay" src="https://liberapay.com/assets/widgets/donate.svg"/></a>
        </div>
        <div className="input">
          <input ref={this.setRef}/>
          <div className={"sk-cube-grid" + active} onClick={this.submit}>
            <span>Go</span>
            <div className="sk-cube sk-cube1"></div>
            <div className="sk-cube sk-cube2"></div>
            <div className="sk-cube sk-cube3"></div>
            <div className="sk-cube sk-cube4"></div>
            <div className="sk-cube sk-cube5"></div>
            <div className="sk-cube sk-cube6"></div>
            <div className="sk-cube sk-cube7"></div>
            <div className="sk-cube sk-cube8"></div>
            <div className="sk-cube sk-cube9"></div>
          </div>
        </div>
        {result}
        {errors}
      </div>
    )
  }
})

let TestResults = create({
  displayName: "TestResults",

  render: function() {
    return (
      <div className="results">
        <ConnectionErrors json={this.props.json.ConnectionErrors}/>
        <ConnectionReports json={this.props.json.ConnectionReports}/>
        <DNSResult json={this.props.json.DNSResult}/>
      </div>
    );
  }
})

let ConnectionReports = create({
  displayName: "ConnectionErrors",

  render: function() {
    let j = this.props.json;
    let connections = Object.keys(j).map((ip, id) => {
      let info = j[ip];
      return <ReportTable info={info} key={id} ip={ip}/>;
    });
    return (
      <div className="connection">
        <h2>Connection Reports</h2>
        {connections}
      </div>
    );
  }
});

let ConnectionErrors = create({
  displayName: "ConnectionErrors",

  render: function() {
    let j = this.props.json;
    if (Object.keys(j).length == 0) {
      return null;
    }
    let connections = Object.keys(j).map((ip, id) => {
      let info = j[ip];
      if (info.Message != null) {
        return info.Message;
      }
      return <ReportTable info={info} key={id} ip={ip}/>;
    });
    return (
      <div className="connection err">
        <h2>Connection Errors</h2>
        {connections}
      </div>
    );
  }
});

let ReportTable = create({
  displayName: "ReportTable",

  getInitialState: function() {
    return ({
      collapsed: {
        info: true,
        checks: this.props.info.Checks.AllChecksOK
      }
    });
  },

  toggle: function(element) {
    let collapsed = this.state.collapsed
    collapsed[element] = !collapsed[element]
    this.setState({
      collapsed: collapsed
    });
  },

  render: function() {
    let checks = <TableFromObject object={this.props.info.Checks} collapsed={this.state.collapsed.checks} tree={1} type="error" />;
    let info = <TableFromObject object={this.props.info.Info} collapsed={this.state.collapsed.info} tree={1} type="info" />;
    let checksIcon = icons.right;
    let infoIcon = icons.right;

    let falseRow = {
      symbol: "Error",
      className: "false"
    }

    let trueRow = {
      symbol: "Success",
      className: "true"
    }

    let rows = {
      checks: falseRow,
      cert: {
        symbol: "Warning",
        className: "warn"
      }
    }

    if (!this.state.collapsed["checks"]) {
      checksIcon = icons.down;
    }

    if (!this.state.collapsed["info"]) {
      infoIcon = icons.down;
    }

    if (this.props.info.Checks.AllChecksOK) {
      rows.checks = trueRow
    }

    if (this.props.info.ValidCertificates) {
      rows.cert = trueRow
    }

    return (
      <div>
        <h3>{this.props.ip}</h3>
        <div className="table">
          <div className="body">
            <div className="row">
              <div className="col">Valid Certificate</div>
              <div className={"col bool " + rows.cert.className}>{rows.cert.symbol}</div>
            </div>
            <div className="row toggle" onClick={() => this.toggle("info")}>
              {infoIcon}
              <div className="col">Information</div>
              <div className="col bool info">Information</div>
            </div>
            {info}
            <div className="row toggle" onClick={() => this.toggle("checks")}>
              {checksIcon}
              <div className="col">Other Checks</div>
              <div className={"col bool " + rows.checks.className}>{rows.checks.symbol}</div>
            </div>
            {checks}
          </div>
        </div>
      </div>
    );
  }
});

function recursiveCheck(objectOrBool, path, bubble) {
  if (typeof objectOrBool == typeof true) {
    if (!objectOrBool) {
      if (bubble) {
        bubble(path)
      }
      return true
    }
  } else {
    let anyErrors
    Object.keys(objectOrBool).forEach((childKey) => {
      let childValue = objectOrBool[childKey]
      if (recursiveCheck(childValue, path + `.${childKey}`, bubble)) {
        anyErrors = true
      }
    })
    if (anyErrors) {
      return true
    }
  }
}

let TableFromObject = create({
  displayName: "TableFromObject",

  getInitialState: function() {
    return ({
      collapsed: this.props.collapsed
    });
  },

  toggle: function() {
    let collapsed = this.state.collapsed;
    if (collapsed) {
      collapsed = false;
    } else {
      collapsed = true;
    }
    this.setState({
      collapsed: collapsed
    });
  },

  render: function() {
    let objectArray = Object.keys(this.props.object);
    return objectArray.map((check, id) => {
      let symbol
      let className
      if (this.props.type == "error") {
        symbol = "Error";
        className = "false";
        if (this.props.object[check]) {
          symbol = "Success";
          className = "true";
        }
      } else if (this.props.type == "info") {
        symbol = "No";
        className = "false";
        if (this.props.object[check]) {
          symbol = "Yes";
          className = "true";
        }
      }

      if (check == "AllChecksOK") {
        return null;
      } else if (!this.props.collapsed) {
        if (typeof(this.props.object[check]) == "boolean") {
          return (
            <div className={`row toggle tree-${this.props.tree} ${this.props.type}Row`} key={id}>
              <div className="col">{check}</div>
              <div className={"col bool " + className}>{symbol}</div>
            </div>
          );
        } else {
          let childrenBool = "true"
          let childrenSymbol = "Success"
          if (recursiveCheck(this.props.object[check], "Checks")) {
            //will return true if any children are false
            childrenBool = "false"
            childrenSymbol = "Error"
          }
          return (
            <div key={id}>
              <div className={"row toggle tree-" + this.props.tree} onClick={this.toggle}>
                <div className="col">{check}</div>
                <div className={"col bool " + childrenBool}>{childrenSymbol}</div>
              </div>
              <TableFromObject object={this.props.object[check]} collapsed={false} key={id} tree={this.props.tree+1} />
            </div>
          );
        }
      }
      return null;
    });
  }
});

let DNSResult = create({
  displayName: "DNS",

  render: function() {
    let j = this.props.json;
    if (j.SRVRecords == null) {
      return (
        <div className="dns">
          <h2>No SRV Records</h2>
        </div>
      );
    }

    let records = j.SRVRecords.map((record, id) => {
      return (
        <div className="row" key={id}>
          <div className="col">{record.Target}</div>
          <div className="col">{record.Port}</div>
          <div className="col">{record.Priority}</div>
          <div className="col">{record.Target}</div>
        </div>
      );
    });

    let hosts = Object.keys(j.Hosts).map((host) => {
      return j.Hosts[host].Addrs.map((address, id) => {
        return (
          <div className="row" key={id}>
            <div className="col">{address}</div>
          </div>
        );
      });
    });

    return (
      <div className="dns">
        <h2>DNS records for {j.SRVCName}</h2>
        <div className="table">
          <div className="header">
            <span className="col">Target</span>
            <span className="col">Port</span>
            <span className="col">Priority</span>
            <span className="col">Target</span>
          </div>
          <div className="body">
            {records}
          </div>
        </div>
        <div className="table">
          <div className="head">
            Address
          </div>
          <div className="body">
            {hosts}
          </div>
        </div>
      </div>
    );
  }
});

ReactDOM.render(
  <App />,
  document.getElementById('root')
)
