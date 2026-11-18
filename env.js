// Configuração padrão quando a página é servida como arquivo estático
// (GitHub Pages, Live Server, nginx...). Nesse caso o navegador chama
// as APIs diretamente, então elas precisam liberar CORS para esta origem.
//
// Quando a SPA é servida pelo `server.js`, este arquivo é substituído
// em tempo de execução por { proxy: true } e as chamadas passam pelo
// proxy embutido, sem problemas de CORS.
window.RTC_ENV = {
  proxy: false,
  apis: {
    regime: "http://localhost:8080/api",
    simples: "http://localhost:8082/api",
    danfse: "http://localhost:8081"
  }
};
