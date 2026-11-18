// Define como a interface encontra as três APIs.
//
// - Rodando localmente como arquivo estático (Live Server, python -m http.server...):
//   o navegador chama cada API direto nos endereços abaixo, e elas precisam
//   liberar CORS para esta origem.
// - Servida pelo `server.js`: este arquivo é substituído em tempo de execução
//   por { proxy: true } e as chamadas passam pelo proxy embutido.
// - Publicada num domínio (Vercel): as APIs ficam no mesmo projeto, nos caminhos
//   /proxy/regime, /proxy/simples e /proxy/danfse (ver vercel.json).
(function () {
  var local = ["localhost", "127.0.0.1", "[::1]", ""].indexOf(location.hostname) !== -1;
  window.RTC_ENV = {
    proxy: !local,
    apis: {
      regime: "http://localhost:8080/api",
      simples: "http://localhost:8082/api",
      danfse: "http://localhost:8081"
    }
  };
})();
