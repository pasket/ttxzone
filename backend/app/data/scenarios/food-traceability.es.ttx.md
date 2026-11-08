---
format: "ttx-zone.scenario"
format_version: 8
language: "es"
title: "¿Podemos fiarnos de los registros de lote?"
exported_at: "2026-11-05T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# ¿Podemos fiarnos de los registros de lote?

Un grupo alimentario descubre una intrusión prolongada en portátiles de directivos. Cuando el atacante llega a recetas, etiquetas y trazabilidad, la pregunta deja de ser qué se robó y pasa a ser si alguien puede demostrar que lo que hay en los lineales es seguro. Lo que ocurre después depende del equipo: los injects contingentes saltan si la contención o la comunicación fallan.

> Escenario de TTX-Zone. Impórtalo desde Biblioteca → Escenarios. La parte legible se genera al exportar; solo se importa el bloque de datos del final.

## Objetivos

- **OBJ-01** Contener, también arriba
- **OBJ-02** Demostrar los registros antes de liberar producto
- **OBJ-03** Responder a las autoridades con pruebas
- **OBJ-04** Los mismos hechos para todos

## Escenario

{organization} fabrica y distribuye alimentos con la marca {brand} desde {plant_1} y {plant_2}. Las recetas están en {recipe_system}, y lotes, palés y decisiones de liberación en {traceability_system}. Distribuidores y consumidores confían en esos registros sin verlos nunca.

## Fases e injects

### PH-01 El intruso silencioso

Día 1. Una alerta extraña de un portátil en un país.

- **INJ-01** (T+5′) Portátiles de directivos hablando con nadie
- **INJ-02** (T+20′) Un directivo no entrega el portátil
- **INJ-03** (contingente) Phishing desde el portátil aún conectado
- **INJ-04** (T+34′) Un mes dentro, y lo que tocaron

### PH-02 ¿Podemos fiarnos de los registros?

Día 4. El incidente sale de la empresa.

- **INJ-05** (T+55′) Reembolsos que nadie ha ofrecido
- **INJ-06** (T+66′) Administrador de dominio y código a la espera
- **INJ-07** (contingente) El código se activa
- **INJ-08** (T+84′) Una etiqueta que no coincide
- **POL-09** (T+94′) Qué hacer con el producto
  - Hay lotes en distribución que no se pueden verificar del todo. ¿Qué haces?
    - Retirar ya todos los lotes del periodo sospechoso
      - Los consumidores quedan protegidos sin duda. Cuesta muchísimo, la historia se hace pública de inmediato y los distribuidores preguntan el motivo.
    - Retener el stock en almacenes propios y validar, sin tocar los lineales
      - Paras el flujo sin alarmar. Lo que ya está en los lineales sigue ahí mientras trabajas, y cada día cuesta más defenderlo.
    - Informar a la autoridad alimentaria y acordar el alcance con ella
      - Compartes la decisión con quien puede valorarla. Pierdes el control de los plazos y puede venir una medida pública.
    - Seguir expidiendo y analizar muestras en laboratorio
      - La producción sigue. Una muestra no demuestra un registro, y si después aparece algo, esta decisión será el titular.

### PH-03 Miedo público

Día 19. Semanas de recuperación discreta terminan con una alerta de monitorización digital.

- **INJ-10** (T+110′) Recetas a la venta para un solo comprador
- **INJ-11** (T+118′) La plantilla quiere saber
- **INJ-12** (contingente) Una reclamación formal
- **INJ-13** (T+130′) La autoridad pide pruebas
- **INJ-14** (T+138′) La prensa tiene una lista de acusaciones
- **INJ-15** (contingente) Un aviso de retirada falso se hace viral
- **POL-16** (T+148′) Qué decir esta noche
  - La noticia sale esta noche. ¿Qué haces?
    - Publicar una declaración que separe lo robado de lo no verificado, con el estado de la revisión alimentaria
      - Baja la especulación sobre productos inseguros. Te comprometes con hechos que debes poder demostrar, y cualquier corrección posterior se notará.
    - Decir solo que colaboráis con las autoridades
      - Seguro y breve. Las acusaciones quedan en pie esta noche, y los distribuidores sacarán sus conclusiones.
    - Negar rotundamente las acusaciones alimentarias
      - Un titular fuerte durante un día. La validación no ha terminado: si un lote falla, la negación será la noticia.
    - Informar primero a distribuidores y autoridad, y publicar por la mañana
      - Tus socios lo oyen de ti, y lo recordarán. La prensa publica esta noche sin ti, y la mañana queda lejos.

### PH-04 Cierre

Día 28. Ningún sistema nuevo muestra comportamiento malicioso.

- **DSC-17** (T+160′) Antes de cerrar el incidente
- **DSC-18** (T+170′) Meses después: un comprador sin nombre

## Actores simulados

- **ACT-01** SOC
- **ACT-02** Proveedor de respuesta a incidentes (retainer)
- **ACT-03** Cliente
- **ACT-04** Medios de comunicación
- **ACT-05** Proveedor de inteligencia de amenazas
- **ACT-06** Empleado
- **ACT-07** Presidencia del consejo
- **ACT-08** Unidad de delitos informáticos
- **ACT-09** Autoridad de seguridad alimentaria
- **ACT-10** Representantes de la plantilla

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 8,
  "language": "es",
  "exported_at": "2026-11-05T00:00:00Z",
  "exercise": {
    "name": "¿Podemos fiarnos de los registros de lote?",
    "description": "Un grupo alimentario descubre una intrusión prolongada en portátiles de directivos. Cuando el atacante llega a recetas, etiquetas y trazabilidad, la pregunta deja de ser qué se robó y pasa a ser si alguien puede demostrar que lo que hay en los lineales es seguro. Lo que ocurre después depende del equipo: los injects contingentes saltan si la contención o la comunicación fallan."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "regulatory",
      "new_threat"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
      "NIS2",
      "GDPR"
    ],
    "regulatory_framework_other": "",
    "capabilities": [
      "crisis_decision_making",
      "continuity_recovery",
      "regulatory_notification",
      "internal_external_comms"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Responsable del incidente",
      "CISO",
      "Operaciones de seguridad",
      "Operaciones de TI",
      "Seguridad alimentaria y calidad",
      "Operaciones de planta",
      "Legal",
      "Delegado de protección de datos",
      "Comunicación",
      "Atención al consumidor",
      "Recursos humanos",
      "Cuentas de distribución",
      "Consejero delegado",
      "Comité de crisis"
    ],
    "third_parties": [],
    "perimeter": "Dispositivos de directivos, identidades, recetas, etiquetado, trazabilidad, liberación de producto, fraude a consumidores y comunicación de crisis.",
    "out_of_scope": "Análisis de laboratorio de productos reales y cualquier contacto real con autoridades o distribuidores.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "CÁMARA FRÍA",
    "needs": [
      {
        "code": "NEED-01",
        "source": "regulatory",
        "title": "Nadie puede imponerse a un directivo",
        "finding": "El plan de incidentes no dice quién puede retirar un dispositivo a un alto directivo durante un incidente.",
        "affected_capability": "crisis_decision_making",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "regulatory",
        "title": "La trazabilidad nunca se ha probado bajo ataque",
        "finding": "Los simulacros de retirada dan por buenos los registros de lote y etiqueta. Ninguno ha planteado qué pasa si no son fiables.",
        "affected_capability": "continuity_recovery",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "Consumidores, distribuidores y plantilla oyen cosas distintas",
        "finding": "Atención al consumidor, cuentas de distribución y recursos humanos tienen cada uno su proceso y ninguna fuente común de hechos.",
        "affected_capability": "internal_external_comms",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Contener, también arriba",
        "statement": "El equipo escala por la cadena acordada y controla todos los dispositivos y cuentas afectados, incluidos los de altos directivos.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Escalado al nivel adecuado\nDispositivo aislado o credenciales revocadas\nAlternativa de trabajo ofrecida",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "El registro del incidente.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Demostrar los registros antes de liberar producto",
        "statement": "Seguridad alimentaria y operaciones acuerdan qué validar en recetas, etiquetas y lotes, y retienen lo que no se pueda demostrar.",
        "capability": "continuity_recovery",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Criterios de validación acordados\nLotes sin verificar identificados y retenidos\nResponsable de la liberación nombrado",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "El plan de validación y la lista de lotes.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Responder a las autoridades con pruebas",
        "statement": "El equipo cumple sus obligaciones de notificación de brecha e incidente y entrega a la autoridad alimentaria un paquete de garantías documentado.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Decisiones de notificación registradas\nContacto regulatorio nombrado\nPaquete de evidencias asignado",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Las notificaciones y el paquete de evidencias.",
        "regulatory_requirement_ids": [
          "GDPR-33-34",
          "NIS2-23"
        ]
      },
      {
        "code": "OBJ-04",
        "title": "Los mismos hechos para todos",
        "statement": "Consumidores, distribuidores, plantilla y medios reciben mensajes coherentes que separan lo confirmado de lo que no lo está.",
        "capability": "internal_external_comms",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Portavoz nombrado\nHechos confirmados y no confirmados separados\nPlantilla informada antes que los medios",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Los mensajes y su cronología.",
        "regulatory_requirement_ids": []
      }
    ],
    "risks": [
      {
        "risk": "Ocurre un incidente real durante la sesión.",
        "mitigation": "Cualquiera puede detener el ejercicio con la palabra clave."
      },
      {
        "risk": "El debate deriva hacia la ciencia alimentaria.",
        "mitigation": "El Facilitador lo centra en quién decide y con qué evidencia."
      }
    ],
    "next_need_number": 4,
    "next_objective_number": 5
  },
  "msel": {
    "title": "Trazabilidad alimentaria",
    "summary": "{organization} fabrica y distribuye alimentos con la marca {brand} desde {plant_1} y {plant_2}. Las recetas están en {recipe_system}, y lotes, palés y decisiones de liberación en {traceability_system}. Distribuidores y consumidores confían en esos registros sin verlos nunca.",
    "attack_version": "19.2",
    "duration_minutes": 180,
    "time_compression": 20,
    "phases": [
      {
        "code": "PH-01",
        "name": "El intruso silencioso",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Día 1. Una alerta extraña de un portátil en un país.",
        "key_questions": [
          "¿Quién puede retirar un portátil a un alto directivo?",
          "¿Cuáles de estos archivos podrían dañar a los consumidores, no solo al negocio?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          }
        ],
        "headline": "Portátiles de directivos hablando con nadie"
      },
      {
        "code": "PH-02",
        "name": "¿Podemos fiarnos de los registros?",
        "start_offset": 50,
        "end_offset": 105,
        "incident_jump_minutes": 3160,
        "situation_update": "Día 4. El incidente sale de la empresa.",
        "key_questions": [
          "¿Qué debe ser cierto antes de que un lote salga de la planta?",
          "¿Quién lo firma?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": true
          }
        ],
        "headline": "Fraude fuera, dudas dentro"
      },
      {
        "code": "PH-03",
        "name": "Miedo público",
        "start_offset": 105,
        "end_offset": 155,
        "incident_jump_minutes": 20720,
        "situation_update": "Día 19. Semanas de recuperación discreta terminan con una alerta de monitorización digital.",
        "key_questions": [
          "¿Qué podemos demostrar hoy sobre la seguridad alimentaria?",
          "¿Quién lo oye primero?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          },
          {
            "code": "OBJ-04",
            "due": true
          }
        ],
        "headline": "Recetas robadas a la venta y dudas en los lineales"
      },
      {
        "code": "PH-04",
        "name": "Cierre",
        "start_offset": 155,
        "end_offset": 180,
        "incident_jump_minutes": 11900,
        "situation_update": "Día 28. Ningún sistema nuevo muestra comportamiento malicioso.",
        "key_questions": [
          "¿Qué nos queda por demostrar?",
          "¿Qué debemos vigilar ahora?"
        ],
        "objectives": [],
        "headline": "Lo que hace falta para cerrar"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Grupo criminal",
        "mitre_group_id": null,
        "aliases": [],
        "description": "Grupo que pasa semanas en portátiles de directivos, luego vende lo robado y deja código preparado para causar daño.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1566.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1071.004"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1558.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1485"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1565.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1041"
          }
        ]
      }
    ],
    "injects": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-01",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Portátiles de directivos hablando con nadie",
        "content": "Una regla del SIEM detecta miles de peticiones DNS inusuales desde un portátil hacia infraestructura sin justificación de negocio. La búsqueda encuentra el mismo patrón en una docena de equipos de varios países, varios de directivos con acceso a estrategia, recetas, compras y cadena de suministro.",
        "offset_minutes": 5,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-01",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Operaciones de seguridad",
          "CISO"
        ],
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0011",
            "technique_id": "T1071.004"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-01-A1",
            "description": "Abre un único incidente coordinado y conserva registros de DNS, proxy e identidades.",
            "responsible_role": "Operaciones de seguridad",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-01-A2",
            "description": "Decide si bloquear los destinos o vigilarlos por ahora.",
            "responsible_role": "CISO",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Un directivo no entrega el portátil",
        "content": "Un directivo afectado lleva días de baja. Otro se niega a entregar o aislar su portátil: tiene las cifras de una negociación con {customer}, el mayor cliente de distribución, y una reunión de lanzamiento mañana. El portátil sigue conectado a los servicios corporativos.",
        "offset_minutes": 20,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-06",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "CISO",
          "Responsable del incidente",
          "Consejero delegado"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Escala por la cadena ejecutiva y obtiene una decisión.",
            "responsible_role": "CISO",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-02-A2",
            "description": "Aísla el equipo o revoca sus credenciales y ofrece una alternativa.",
            "responsible_role": "Responsable del incidente",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-03",
        "phase_code": "PH-01",
        "kind": "contingent",
        "title": "Phishing desde el portátil aún conectado",
        "content": "El servicio de atención y dos distribuidores informan de correos desde la cuenta real del directivo con un PDF que instala la misma herramienta. Han llegado a plantilla, proveedores y clientes de distribución. Quienes confiaron en el remitente los han abierto.",
        "offset_minutes": null,
        "trigger_condition": "El portátil sigue conectado 15 minutos después de INJ-02.",
        "contingent_purpose": "Mostrar el coste de retrasar la contención.",
        "fires_at_minute": 36,
        "branch_from_code": "INJ-02",
        "branch_action_code": "INJ-02-A2",
        "rejoin_code": "INJ-05",
        "sender_code": "ACT-01",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Operaciones de seguridad",
          "CISO",
          "Cuentas de distribución"
        ],
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1566.001"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01",
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "Revoca la cuenta y localiza quién abrió el adjunto.",
            "responsible_role": "Operaciones de seguridad",
            "expected_within_minutes": 8,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-03-A2",
            "description": "Avisa a proveedores y distribuidores por un canal verificado.",
            "responsible_role": "Cuentas de distribución",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-04"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-04",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Un mes dentro, y lo que tocaron",
        "content": "Todos los portátiles analizados tienen la misma herramienta de acceso remoto, activa desde hace más de un mes. La memoria contiene referencias a documentos del consejo, recetas de {recipe_system}, diagramas de red de {plant_1} y {plant_2}, umbrales de laboratorio, condiciones de proveedores, datos de contacto de plantilla y consumidores y datos bancarios. Puede que la lista no esté completa.",
        "offset_minutes": 34,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-02",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "CISO",
          "Seguridad alimentaria y calidad",
          "Legal",
          "Comité de crisis"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01",
          "OBJ-02",
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-04-A1",
            "description": "Evalúa si recetas, controles de alérgenos o umbrales crean un riesgo alimentario.",
            "responsible_role": "Seguridad alimentaria y calidad",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-04-A2",
            "description": "Inicia la evaluación de la brecha con el delegado de protección de datos.",
            "responsible_role": "Legal",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-04-A3",
            "description": "Propone activar el comité de crisis y el ciberseguro.",
            "responsible_role": "CISO",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-05",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Reembolsos que nadie ha ofrecido",
        "content": "Estimado cliente de {brand}: por un problema de calidad en una compra reciente tienes derecho a un reembolso. Confirma tus datos de pago en refunds.example.com en 24 horas. Abajo aparecen tu número de fidelización y tu último pedido.",
        "offset_minutes": 55,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-03",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Atención al consumidor",
          "Comunicación",
          "Delegado de protección de datos"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Un consumidor reenvió este mensaje a atención al cliente. El problema de calidad inventado es lo que usa el fraude: no es real.",
        "objective_codes": [
          "OBJ-03",
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-05-A1",
            "description": "Avisa a consumidores y distribuidores y les da un lugar oficial de consulta.",
            "responsible_role": "Atención al consumidor",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-04"
            ]
          },
          {
            "code": "INJ-05-A2",
            "description": "Vincula los datos del fraude con su origen interno y revisa la notificación.",
            "responsible_role": "Delegado de protección de datos",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": {
          "kind": "email",
          "sender": "Atención al cliente de {brand}",
          "sender_address": "care@refunds.example.com",
          "recipient": "Cliente del programa de fidelización",
          "subject": "Tu reembolso te espera",
          "timestamp": "Día 4, 08:00",
          "location": ""
        },
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-06",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Administrador de dominio y código a la espera",
        "content": "Cuentas de administrador ilegítimas en dominios regionales, con artefactos compatibles con un Golden Ticket, dieron al actor acceso a {recipe_system}, {traceability_system}, el sistema de ejecución de fabricación y los sistemas de calidad. Los analistas encuentran además código en identidades, correo y {traceability_system} diseñado para activarse si se pierde el contacto con el actor.",
        "offset_minutes": 66,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-02",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Operaciones de seguridad",
          "Operaciones de TI",
          "CISO"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0006",
            "technique_id": "T1558.001"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1485"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-06-A1",
            "description": "Audita cuentas y tickets privilegiados antes de cortar nada.",
            "responsible_role": "Operaciones de TI",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-06-A2",
            "description": "Decide cómo neutralizar el código sin activarlo ni perder las evidencias.",
            "responsible_role": "CISO",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-07",
        "phase_code": "PH-02",
        "kind": "contingent",
        "title": "El código se activa",
        "content": "El correo y el acceso dejan de funcionar para casi toda la plantilla. Las nóminas se corrompen. El sistema de fabricación pierde órdenes y estado de lotes, {traceability_system} muestra lotes y palés incoherentes y varias líneas de envasado reciben plantillas antiguas de etiquetas. {plant_1} y {plant_2} se paran: nadie puede confirmar declaraciones de ingredientes, alérgenos ni estado de liberación.",
        "offset_minutes": null,
        "trigger_condition": "Sin auditoría de cuentas privilegiadas 15 minutos después de INJ-06.",
        "contingent_purpose": "Convertir un incidente de datos en uno operativo y alimentario.",
        "fires_at_minute": 32,
        "branch_from_code": "INJ-06",
        "branch_action_code": "INJ-06-A1",
        "rejoin_code": "INJ-08",
        "sender_code": "ACT-06",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Operaciones de planta",
          "Seguridad alimentaria y calidad",
          "Comité de crisis",
          "Recursos humanos"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1485"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1565.001"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-02",
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-07-A1",
            "description": "Monta un canal alternativo para el equipo de crisis.",
            "responsible_role": "Comité de crisis",
            "expected_within_minutes": 8,
            "objective_codes": [
              "OBJ-04"
            ]
          },
          {
            "code": "INJ-07-A2",
            "description": "Pone en cuarentena la producción que no se puede verificar.",
            "responsible_role": "Operaciones de planta",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-08",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Una etiqueta que no coincide",
        "content": "La persona responsable de calidad de {plant_2} escribe: una comprobación ha encontrado un palé de {product} cuya etiqueta no coincide con la versión de receta. Podría ser un error anterior al incidente. Nadie lo sabe, porque el actor tenía permiso de escritura en los registros. Varios lotes han salido a distribución en las dos últimas semanas.",
        "offset_minutes": 84,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-06",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Seguridad alimentaria y calidad",
          "Operaciones de planta",
          "Responsable del incidente"
        ],
        "delivery_method": "chat",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1565.001"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-08-A1",
            "description": "Define qué debe validarse y con qué fuente de confianza.",
            "responsible_role": "Seguridad alimentaria y calidad",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-08-A2",
            "description": "Identifica los lotes fabricados mientras los registros no eran fiables.",
            "responsible_role": "Operaciones de planta",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "POL-09",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Qué hacer con el producto",
        "content": "No hay daños notificados. Tampoco puedes demostrar los registros.",
        "offset_minutes": 94,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": null,
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [],
        "delivery_method": "document",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Cierra la votación confirmando la opción elegida y muestra el resultado: la mesa lee su consecuencia. El siguiente inject funciona gane la opción que gane. Cada decisión suma en los medidores: muestra su resumen en el hot wash.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "poll",
        "poll_question": "Hay lotes en distribución que no se pueden verificar del todo. ¿Qué haces?",
        "poll_options": [
          "Retirar ya todos los lotes del periodo sospechoso",
          "Retener el stock en almacenes propios y validar, sin tocar los lineales",
          "Informar a la autoridad alimentaria y acordar el alcance con ella",
          "Seguir expidiendo y analizar muestras en laboratorio"
        ],
        "poll_outcomes": [
          "Los consumidores quedan protegidos sin duda. Cuesta muchísimo, la historia se hace pública de inmediato y los distribuidores preguntan el motivo.",
          "Paras el flujo sin alarmar. Lo que ya está en los lineales sigue ahí mientras trabajas, y cada día cuesta más defenderlo.",
          "Compartes la decisión con quien puede valorarla. Pierdes el control de los plazos y puede venir una medida pública.",
          "La producción sigue. Una muestra no demuestra un registro, y si después aparece algo, esta decisión será el titular."
        ],
        "poll_impacts": [
          {
            "m1": 3,
            "m3": 2,
            "m4": 3,
            "m5": 3
          },
          {
            "m1": 2,
            "m2": 2,
            "m3": 2,
            "m4": 2,
            "m5": 1
          },
          {
            "m1": 2,
            "m2": 1,
            "m3": 2,
            "m4": 2,
            "m5": 1
          },
          {
            "m2": 3,
            "m3": 1,
            "m4": 3,
            "m5": 1
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-10",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Recetas a la venta para un solo comprador",
        "content": "En foros aparecen enlaces a una subasta en un servicio oculto, al mejor postor: capturas con el logo de {brand}, una lista de archivos de recetas y procesos, diagramas de red de plantas, contratos con proveedores y documentos de liberación de producto. Algunos enlaces se pueden retirar, la subasta no. Los blogs especializados empiezan a preguntar.",
        "offset_minutes": 110,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-05",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "CISO",
          "Legal",
          "Seguridad alimentaria y calidad",
          "Comité de crisis"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-02",
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-10-A1",
            "description": "Conserva los anuncios, los verifica e informa a la policía.",
            "responsible_role": "Legal",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-10-A2",
            "description": "Evalúa el riesgo de falsificaciones y ataques dirigidos a plantas.",
            "responsible_role": "Seguridad alimentaria y calidad",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-11",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "La plantilla quiere saber",
        "content": "Los representantes de la plantilla escriben que circulan rumores sobre recetas robadas, datos personales y errores en nóminas. Preguntan qué está confirmado, qué significa para turnos y personal temporal y por qué se enteran por los pasillos.",
        "offset_minutes": 118,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-10",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Recursos humanos",
          "Comunicación"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-11-A1",
            "description": "Envía a la plantilla un mensaje con lo confirmado y dónde preguntar, y se reúne con los representantes.",
            "responsible_role": "Recursos humanos",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-04"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-12",
        "phase_code": "PH-03",
        "kind": "contingent",
        "title": "Una reclamación formal",
        "content": "Los representantes de la plantilla han presentado una reclamación formal por la gestión de los datos personales, los errores en nóminas y el retraso en informar. La prensa local de dos países ya lo publica.",
        "offset_minutes": null,
        "trigger_condition": "Sin mensaje a la plantilla 10 minutos después de INJ-11.",
        "contingent_purpose": "Mostrar el coste de dejar a la plantilla para el final.",
        "fires_at_minute": 24,
        "branch_from_code": "INJ-11",
        "branch_action_code": "INJ-11-A1",
        "rejoin_code": "INJ-13",
        "sender_code": "ACT-10",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Recursos humanos",
          "Legal"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-12-A1",
            "description": "Conserva la cronología de decisiones y dialoga por un canal documentado.",
            "responsible_role": "Legal",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-04"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-13",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "La autoridad pide pruebas",
        "content": "La autoridad alimentaria exige pruebas de que ningún cambio no autorizado de receta o alérgenos entró en producción, de que la trazabilidad de lotes y palés siguió siendo fiable, de que las decisiones de liberación se basaron en registros de confianza y de que cualquier producto afectado se localizó, retuvo o retiró. Por separado, el regulador de mercados pregunta si la información se divulgó a tiempo.",
        "offset_minutes": 130,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-09",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Seguridad alimentaria y calidad",
          "Legal",
          "Responsable del incidente"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-13-A1",
            "description": "Nombra un único contacto regulatorio y conserva decisiones y evidencias.",
            "responsible_role": "Legal",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-13-A2",
            "description": "Asigna el paquete de garantías sobre recetas, alérgenos y trazabilidad.",
            "responsible_role": "Seguridad alimentaria y calidad",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-14",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "La prensa tiene una lista de acusaciones",
        "content": "Esta noche publicamos sobre {organization}. Nos han dicho que ocultasteis riesgos de alérgenos, cambiasteis resultados de laboratorio, pagasteis a los atacantes y dejasteis a la venta productos con trazabilidad poco fiable. ¿Confirmáis algo de esto?",
        "offset_minutes": 138,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-04",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Comunicación",
          "Consejero delegado"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-14-A1",
            "description": "Separa lo confirmado de lo falso y acuerda un portavoz.",
            "responsible_role": "Comunicación",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-04"
            ]
          },
          {
            "code": "INJ-14-A2",
            "description": "Decide si se publica hoy una posición oficial.",
            "responsible_role": "Consejero delegado",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-04"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": {
          "kind": "email",
          "sender": "Redacción nacional",
          "sender_address": "desk@news.example.org",
          "recipient": "Gabinete de prensa",
          "subject": "Preguntas para la noticia de esta noche",
          "timestamp": "Día 19, 19:00",
          "location": ""
        },
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-15",
        "phase_code": "PH-03",
        "kind": "contingent",
        "title": "Un aviso de retirada falso se hace viral",
        "content": "RETIRADA URGENTE: todo {product} de {brand} puede contener alérgenos no declarados. No lo consumas. Compártelo con tu familia.",
        "offset_minutes": null,
        "trigger_condition": "Sin posición oficial 8 minutos después de INJ-14.",
        "contingent_purpose": "Mostrar qué llena el silencio.",
        "fires_at_minute": 42,
        "branch_from_code": "INJ-14",
        "branch_action_code": "INJ-14-A2",
        "rejoin_code": "DSC-17",
        "sender_code": "ACT-03",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Comunicación",
          "Atención al consumidor",
          "Cuentas de distribución"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-15-A1",
            "description": "Publica información verificable de productos y lotes en canales oficiales.",
            "responsible_role": "Atención al consumidor",
            "expected_within_minutes": 8,
            "objective_codes": [
              "OBJ-04"
            ]
          },
          {
            "code": "INJ-15-A2",
            "description": "Acuerda con los distribuidores qué pasa en el lineal.",
            "responsible_role": "Cuentas de distribución",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-04"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": {
          "kind": "social_post",
          "sender": "Alertas al consumidor",
          "sender_address": "@food_alerts_now",
          "recipient": "",
          "subject": "",
          "timestamp": "Día 19, 21:00",
          "location": ""
        },
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "POL-16",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Qué decir esta noche",
        "content": "Algunas acusaciones son falsas y otras retuercen documentos auténticos robados.",
        "offset_minutes": 148,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": null,
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [],
        "delivery_method": "document",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Cierra la votación confirmando la opción elegida y muestra el resultado: la mesa lee su consecuencia. El siguiente inject funciona gane la opción que gane. Cada decisión suma en los medidores: muestra su resumen en el hot wash.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "poll",
        "poll_question": "La noticia sale esta noche. ¿Qué haces?",
        "poll_options": [
          "Publicar una declaración que separe lo robado de lo no verificado, con el estado de la revisión alimentaria",
          "Decir solo que colaboráis con las autoridades",
          "Negar rotundamente las acusaciones alimentarias",
          "Informar primero a distribuidores y autoridad, y publicar por la mañana"
        ],
        "poll_outcomes": [
          "Baja la especulación sobre productos inseguros. Te comprometes con hechos que debes poder demostrar, y cualquier corrección posterior se notará.",
          "Seguro y breve. Las acusaciones quedan en pie esta noche, y los distribuidores sacarán sus conclusiones.",
          "Un titular fuerte durante un día. La validación no ha terminado: si un lote falla, la negación será la noticia.",
          "Tus socios lo oyen de ti, y lo recordarán. La prensa publica esta noche sin ti, y la mañana queda lejos."
        ],
        "poll_impacts": [
          {
            "m2": 1,
            "m3": 2,
            "m4": 1
          },
          {
            "m2": 2,
            "m3": 1,
            "m4": 2
          },
          {
            "m2": 3,
            "m3": 1,
            "m4": 3
          },
          {
            "m2": 2,
            "m3": 2,
            "m4": 2,
            "m5": 1
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "DSC-17",
        "phase_code": "PH-04",
        "kind": "mandatory",
        "title": "Antes de cerrar el incidente",
        "content": "El comité de crisis se reúne para decidir el cierre. Los sistemas se han restaurado desde fuentes validadas. ¿Qué debe confirmarse sobre recetas, declaraciones de alérgenos, etiquetas y registros de lote antes de cerrar, qué se debe aún a autoridades, distribuidores y plantilla, y quién sigue vigilando?",
        "offset_minutes": 160,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-07",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Consejero delegado",
          "Comité de crisis"
        ],
        "delivery_method": "in_person",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Usa la cuenta de las votaciones. Si la duda alimentaria terminó alta, el incidente no está cerrado, digan lo que digan los sistemas.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "discussion",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "DSC-18",
        "phase_code": "PH-04",
        "kind": "mandatory",
        "title": "Meses después: un comprador sin nombre",
        "content": "La policía detiene a una persona vinculada al grupo. Los registros de la subasta muestran que una parte comercial compró parte del material robado, y nadie sabe quién. ¿Qué recetas, contratos o detalles de planta necesitan cambios de protección y cómo notaríais su uso indebido?",
        "offset_minutes": 170,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-08",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "CISO",
          "Legal",
          "Seguridad alimentaria y calidad"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Cierra con mejoras, cada una con responsable y fecha: política de dispositivos de directivos, confianza en los registros y simulacros de retirada con datos malos.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "discussion",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      }
    ],
    "next_phase_number": 5,
    "next_inject_number": 19,
    "next_threat_actor_number": 2,
    "meters": [
      {
        "key": "m1",
        "name": "Producción"
      },
      {
        "key": "m2",
        "name": "Duda alimentaria"
      },
      {
        "key": "m3",
        "name": "Estrés del equipo"
      },
      {
        "key": "m4",
        "name": "Legal y marca"
      },
      {
        "key": "m5",
        "name": "Presupuesto"
      }
    ]
  },
  "cast": [
    {
      "origin": "system",
      "origin_id": "soc",
      "origin_name": "SOC",
      "code": "ACT-01",
      "name": "SOC",
      "type": "soc",
      "description": "El centro de operaciones de seguridad: alertas, hallazgos y peticiones de decisión.",
      "channel": "ticket"
    },
    {
      "origin": "system",
      "origin_id": "dfir-provider",
      "origin_name": "Proveedor de respuesta a incidentes (retainer)",
      "code": "ACT-02",
      "name": "Proveedor de respuesta a incidentes (retainer)",
      "type": "supplier",
      "description": "El equipo externo de respuesta y forense, normalmente con un contrato (retainer) que se activa durante el incidente: hallazgos, informes y recomendaciones de contención.",
      "channel": "briefing"
    },
    {
      "origin": "system",
      "origin_id": "customer",
      "origin_name": "Cliente",
      "code": "ACT-03",
      "name": "Cliente",
      "type": "customer",
      "description": "Un cliente que nota el impacto y pide explicaciones.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "media",
      "origin_name": "Medios de comunicación",
      "code": "ACT-04",
      "name": "Medios de comunicación",
      "type": "media",
      "description": "Periodistas que preguntan o publican sobre el incidente.",
      "channel": "media"
    },
    {
      "origin": "system",
      "origin_id": "threat-intel-provider",
      "origin_name": "Proveedor de inteligencia de amenazas",
      "code": "ACT-05",
      "name": "Proveedor de inteligencia de amenazas",
      "type": "supplier",
      "description": "Vigila foros, sitios de filtraciones y redes: avisa de datos expuestos y de la actividad del atacante.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "insider",
      "origin_name": "Empleado",
      "code": "ACT-06",
      "name": "Empleado",
      "type": "internal",
      "description": "Un empleado que avisa de algo extraño, o el insider que está detrás.",
      "channel": "in_person"
    },
    {
      "origin": "system",
      "origin_id": "board-chair",
      "origin_name": "Presidencia del consejo",
      "code": "ACT-07",
      "name": "Presidencia del consejo",
      "type": "internal",
      "description": "La presidencia del consejo de administración cuando el consejo no juega: pide explicaciones y convoca sesiones.",
      "channel": "phone"
    },
    {
      "origin": "system",
      "origin_id": "police-cybercrime",
      "origin_name": "Unidad de delitos informáticos",
      "code": "ACT-08",
      "name": "Unidad de delitos informáticos",
      "type": "authority",
      "description": "Las fuerzas de seguridad que investigan el ataque y piden evidencias.",
      "channel": "phone"
    },
    {
      "origin": null,
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-09",
      "name": "Autoridad de seguridad alimentaria",
      "type": "authority",
      "description": "La autoridad que supervisa la seguridad alimentaria, las retiradas y la trazabilidad.",
      "channel": "email"
    },
    {
      "origin": null,
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-10",
      "name": "Representantes de la plantilla",
      "type": "internal",
      "description": "Representantes del personal que preguntan por nóminas, turnos y datos personales.",
      "channel": "email"
    }
  ],
  "next_actor_number": 11,
  "tags": [
    {
      "origin": "system",
      "origin_id": "data-breach",
      "origin_name": "Fuga de datos",
      "name": "Fuga de datos",
      "color": "rose",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "wiper",
      "origin_name": "Wiper",
      "name": "Wiper",
      "color": "rose",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "crisis-committee",
      "origin_name": "Comité de crisis",
      "name": "Comité de crisis",
      "color": "indigo",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "communications",
      "origin_name": "Comunicación",
      "name": "Comunicación",
      "color": "indigo",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "gdpr",
      "origin_name": "RGPD",
      "name": "RGPD",
      "color": "slate",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "nis2",
      "origin_name": "NIS2",
      "name": "NIS2",
      "color": "slate",
      "custom_hex": null,
      "applied": true
    }
  ],
  "images": [],
  "uses_rooms": false,
  "rooms": [],
  "next_room_number": 1,
  "files": []
}
```
