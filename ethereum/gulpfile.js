const gulp = require('gulp');
const watch = require('gulp-watch');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const moment = require('moment');
require('ansicolor').nice;
const log = require('ololog').configure({
  separator: '\t',
  time: {
    yes: true,
    print: (x) => `[${moment(x).format('HH:mm:ss').darkGray}] `,
  },
  locate: false,
});

const ERROR = '[ERRO]'.red;
const WARNING = '[WARN]'.yellow;
const INFO = '[INFO]'.cyan;

const contractToTest = (process.env.CONTRACT || '*').trim();

let ganache = undefined;
let runningCmd = undefined;

gulp.task('default', async () => {
  console.log('Options: ', 'test');
});

gulp.task('watch', async (cb) => {
  ganache = await runGanache();

  watch(
    [
      `./contracts/**/${contractToTest}.sol`,
      `./truffle-config.js`,
      `./package.json`,
      `./migrations/**/*.js`,
    ],
    (cb) => {
      compileContractsAndRunTest(cb);
    }
  );

  watch([`./test/**/*.js`], (cb) => {
    test(cb);
  });
});

const compileContractsAndRunTest = (cb) => {
  killCurrentIteration();

  log(INFO, 'Compiling');
  const cmd = exec(`truffle compile`, (err, stdout, stderr) => {
    if (cmd && cmd.killed === true) return;

    console.log(stdout);

    if (err) {
      console.log('Error running UNIX commands');
      console.error(err);
    }

    if (stderr) {
      console.error(stderr);
    }

    if (!err & !stderr) {
      runningCmd = undefined;
      test(cb);
    }
  });

  runningCmd = cmd;
};

const test = (cb) => {
  killCurrentIteration();

  log(INFO, 'Testing...');

  if (contractToTest !== '*') {
    runOneTest(`${contractToTest}`);
  } else if (cb && cb.history && cb.history[0]) {
    const contracts = fs.readdirSync('./contracts');

    for (let i = 0; i < contracts.length; i++) {
      contracts[i] = contracts[i].replace('.sol', '');
    }

    let fileName = path
      .basename(cb.history[0])
      .replace('.sol', '')
      .replace('.js', '');

    if (contracts.includes(fileName)) {
      runOneTest(`${fileName}`);
    } else {
      runAllTests();
    }
  } else {
    runAllTests();
  }
};

const runAllTests = () => {
  const cmd = spawn('truffle', ['test', `--network`, `gulp`, '--bail']).on(
    'error',
    (error) => {
      console.log('Error running UNIX command');
      console.error(error);
    }
  );

  cmd.stdout.on('data', (data) => process.stdout.write(`${data}`));

  cmd.stderr.on('data', (data) => console.error(`${data}`));

  runningCmd = cmd;
};

const runOneTest = (test) => {
  const testFileRelativePath = `./test/${test}.js`;
  if (fs.existsSync(testFileRelativePath)) {
    const cmd = spawn('truffle', [
      'test',
      testFileRelativePath,
      `--network`,
      `gulp`,
      `--bail`,
    ]).on('error', (error) => {
      console.log('Error running UNIX command');
      console.error(error);
    });

    cmd.stdout.on('data', (data) => process.stdout.write(`${data}`));

    cmd.stderr.on('data', (data) => console.error(`${data}`));

    runningCmd = cmd;
  } else {
    log(
      WARNING,
      `Could not find test file ${testFileRelativePath} for ${test}. Skipping`
    );
  }
};

const runGanache = () => {
  return new Promise((resolve, reject) => {
    let resolved = false;
    log(INFO, 'runGanache()');
    const cmd = spawn(`npm`, [`run`, `ganache`]);
    // cmd.on("error", (error) => log(ERROR, error));
    cmd.stdout.on('data', (data) => {
      // log(INFO, `${data}`);
      if (data.toString().includes('Listening on 127.0.0.1:8545')) {
        resolved = true;
        resolve(cmd);
      }
    });
    cmd.on('close', () => {
      log(WARNING, 'Ganache closed');
    });
    setTimeout(() => {
      if (resolved === false) {
        log(ERROR, 'Ganache did not start after 15 seconds');
        if (cmd && !cmd.killed && typeof cmd.kill === 'function') {
          cmd.kill();
        }
        reject();
      }
    }, 15000);
  });
};

const killCurrentIteration = () => {
  if (
    runningCmd &&
    !runningCmd.killed &&
    typeof runningCmd.kill === 'function'
  ) {
    runningCmd.kill();
    runningCmd.unref();
  }
};

function exitHandler(options) {
  if (options.cleanup) {
    log(INFO, 'Checking ganache instance and killing if necessary...');
    if (ganache && !ganache.killed && typeof ganache.kill === 'function') {
      log(INFO, `ganache.kill()`);
      ganache.kill();
    }
  }
  if (options.exit) process.exit();
}

//do something when app is closing
process.on('exit', exitHandler.bind(null, { cleanup: true }));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, { exit: true }));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));
