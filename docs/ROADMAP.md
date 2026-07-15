# Plano do J-Tag

## Etapa 1 - Protótipo navegável

- Criar app Next.js pronto para Vercel.
- Criar tela aberta pela etiqueta NFC.
- Listar moradores.
- Permitir cadastro de novo morador.
- Proteger entrada por PIN.
- Mostrar painel inicial com lembretes, aniversarios e emergencia.

## Etapa 2 - Persistência real

- Criar banco Postgres gerenciado.
- Modelar moradores, perfis, tags, lembretes, aniversarios e contatos.
- Trocar armazenamento local por API e banco.
- Adicionar seeds iniciais para a casa.

## Etapa 3 - Segurança melhor

- Hash de PIN no servidor.
- Sessao por aparelho.
- Passkeys/WebAuthn para Face ID, Touch ID ou biometria Android.
- Permissoes: admin, morador e visitante.

## Etapa 4 - NFC e lugares da casa

- Gravar etiquetas com URLs curtas.
- Criar rotas como `/n/entrada`, `/n/cozinha` e `/n/emergencia`.
- Permitir configurar o que cada etiqueta abre.
- Registrar historico de acessos, se fizer sentido.

## Etapa 5 - Alarmes e notificações

- Lembretes com data e recorrencia.
- Notificacoes push para celulares.
- Painel de alarmes por morador.
- Preferencias de dispositivo.

## Etapa 6 - Funcionalidades futuras

- Lista de compras.
- Medicamentos.
- Tarefas da casa.
- Modo visitante.
- Fotos de perfil.
- Contatos de emergencia completos.
- Integração com calendario.
