const net = require('net');

function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => {
      findAvailablePort(startPort + 1).then(resolve, reject);
    });
    server.listen(startPort, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => {
      resolve(false);
    });
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
  });
}

module.exports = {
  findAvailablePort,
  isPortAvailable
};
