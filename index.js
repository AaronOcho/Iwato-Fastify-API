const fastify = require('fastify')({ logger: false });
const fs = require('fs');
const path = require('path');
const set = require('./settings');
const chalk = require('chalk');

(async () => {
  const PORT = process.env.PORT || 4000;

  const logger = {
    info: (message) => console.log(chalk.dim.blue('•') + chalk.dim(' info  - ') + message),
    ready: (message) => console.log(chalk.dim.green('•') + chalk.dim(' ready - ') + message),
    warn: (message) => console.log(chalk.dim.yellow('•') + chalk.dim(' warn  - ') + message),
    error: (message) => console.log(chalk.dim.red('•') + chalk.dim(' error - ') + message),
    event: (message) => console.log(chalk.dim.cyan('•') + chalk.dim(' event - ') + message),
  };

  fastify.register(require('@fastify/formbody'));
  fastify.register(require('@fastify/static'), {
    root: path.join(__dirname, 'docs'),
    prefix: '/',
  });

  logger.info('Starting server initialization...');

  fastify.addHook('onSend', async (request, reply, payload) => {
    if (reply.getHeader('Content-Type')?.includes('application/json')) {
      let data;
      try {
        data = JSON.parse(payload);
      } catch {
        return payload;
      }
      if (data && typeof data === 'object') {
        const statusCode = reply.statusCode || 200;
        data = {
          status: data.status,
          statusCode,
          creator: (set.author || '').toLowerCase(),
          ...data,
        };
        return JSON.stringify(data);
      }
    }
    return payload;
  });

  String.prototype.capitalize = function () {
    return this.charAt(0).toUpperCase() + this.slice(1);
  };

  function loadEndpointsFromDirectory(directory, baseRoute = '') {
    let endpoints = [];
    const fullPath = path.join(__dirname, directory);

    if (!fs.existsSync(fullPath)) {
      logger.warn(`Directory not found: ${fullPath}`);
      return endpoints;
    }

    logger.info(`Scanning directory: ${directory}...`);
    for (const item of fs.readdirSync(fullPath)) {
      const itemPath = path.join(fullPath, item);
      const stats = fs.statSync(itemPath);

      if (stats.isDirectory()) {
        logger.info(`Found subdirectory: ${item}`);
        endpoints = endpoints.concat(
          loadEndpointsFromDirectory(path.join(directory, item), `${baseRoute}/${item}`)
        );
      } else if (stats.isFile() && item.endsWith('.js')) {
        try {
          const mod = require(itemPath);
          if (mod && typeof mod.onStart === 'function') {
            const name = item.replace('.js', '');
            const route = `${baseRoute}/${name}`;

            fastify.all(route, async (request, reply) => {
              await mod.onStart({ request, reply });
            });

            let displayPath = route;
            if (Array.isArray(mod.meta?.params) && mod.meta.params.length) {
              displayPath += '?' + mod.meta.params.map(p => `${p}=`).join('&');
            }

            const cat = mod.meta.category || 'Other';
            let bucket = endpoints.find(e => e.name === cat);
            if (!bucket) {
              bucket = { name: cat, items: [] };
              endpoints.push(bucket);
            }

            bucket.items.push({
              [mod.meta.name || name]: {
                desc: mod.meta.desc || 'No description provided',
                path: displayPath,
              },
            });

            logger.ready(
              `${chalk.green(route)} ${chalk.dim('(')}${chalk.cyan(cat)}${chalk.dim(')')}`
            );
          }
        } catch (error) {
          logger.error(`Failed to load module ${itemPath}: ${error.message}`);
        }
      }
    }
    return endpoints;
  }

  fastify.get('/', (request, reply) => {
    reply.sendFile('index.html', path.join(__dirname, 'docs'));
  });

  logger.info('Loading API endpoints...');
  const allEndpoints = loadEndpointsFromDirectory('api');
  logger.ready(
    `Loaded ${allEndpoints.reduce((t, c) => t + c.items.length, 0)} endpoints`
  );

  fastify.get('/endpoints', (request, reply) => {
    const total = allEndpoints.reduce((t, c) => t + c.items.length, 0);
    reply.send({ status: true, count: total, endpoints: allEndpoints });
  });

  fastify.get('/set', (request, reply) => {
    reply.send({ status: true, ...set });
  });

  fastify.setNotFoundHandler((request, reply) => {
    logger.info(`404: ${request.method} ${request.url}`);
    reply.status(404).sendFile('err/404.html', path.join(__dirname, 'docs'));
  });

  fastify.setErrorHandler((error, request, reply) => {
    logger.error(`500: ${error.message}`);
    reply.status(500).sendFile('err/500.html', path.join(__dirname, 'docs'));
  });

  try {
    await fastify.listen({ port: PORT });
    logger.ready(`Server started successfully`);
    logger.info(`Local:   ${chalk.cyan(`http://localhost:${PORT}`)}`);

    try {
      const { networkInterfaces } = require('os');
      const nets = networkInterfaces();
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          if (net.family === 'IPv4' && !net.internal) {
            logger.info(
              `Network: ${chalk.cyan(`http://${net.address}:${PORT}`)}`
            );
          }
        }
      }
    } catch (error) {
      logger.warn(`Cannot detect network interfaces: ${error.message}`);
    }

    logger.info(`${chalk.dim('Ready for connections')}`);
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }

  module.exports = fastify;
})();