module.exports = {
  apps: [
    {
      name: "fanstudio",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3000",
      instances: 2,
      exec_mode: "cluster",
      max_memory_restart: "900M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
}
