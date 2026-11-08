---
format: "ttx-zone.scenario"
format_version: 3
language: "es"
title: "Ransomware en una cadena minorista que empezó con una llamada al soporte"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Ransomware en una cadena minorista que empezó con una llamada al soporte

Un grupo experto en ingeniería social llama al soporte informático externalizado, consigue el restablecimiento de la contraseña y el MFA de un empleado y, dos meses después, cifra los servidores de virtualización de una cadena minorista durante un puente largo. Se paran tiendas, venta online y almacenes, y se roban datos de clientes. El ejercicio pone a prueba cuándo una avería pasa a ser una crisis, la confianza en el soporte externalizado y la notificación a los clientes.

> Escenario de TTX-Zone. Impórtalo desde Biblioteca → Escenarios. La parte legible se genera al exportar; solo se importa el bloque de datos del final.

## Objetivos

- **OBJ-01** Crisis declarada y contenida
- **OBJ-02** Confianza en el soporte restablecida
- **OBJ-03** Clientes informados

## Escenario

El sábado de un puente, las tiendas de {organization} informan de que fallan los pagos sin contacto y se pierden las reservas de recogida en tienda. La guardia de TI cree que es una avería.

## Fases e injects

### PH-01 Sábado de puente

Sábado de puente, 11:00. Las tiendas informan de fallos en los pagos con tarjeta.

- **INJ-01** (T+5′) Fallan las cajas y la recogida en tienda
- **INJ-02** (T+25′) Un restablecimiento de MFA hace dos meses

### PH-02 Cifrado

Domingo. Los servidores de virtualización están cifrados; los pedidos online fallan.

- **INJ-03** (T+55′) Cifrados los servidores de virtualización
- **INJ-04** (T+80′) El proveedor de soporte se defiende
- **INJ-05** (T+95′) Se paran los almacenes y se vacían los estantes

### PH-03 Datos de clientes

Diez días después. La investigación confirma que se llevaron datos de clientes.

- **INJ-06** (T+115′) Se llevaron datos de clientes
- **INJ-07** (T+140′) El mismo grupo, otras cadenas

## Actores simulados

- **ACT-01** Empleado
- **ACT-02** SOC
- **ACT-03** Atacante (remitente)
- **ACT-04** Proveedor de servicios gestionados
- **ACT-05** Proveedor de respuesta a incidentes (retainer)
- **ACT-06** Medios de comunicación

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 3,
  "language": "es",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "Ransomware en una cadena minorista que empezó con una llamada al soporte",
    "description": "Un grupo experto en ingeniería social llama al soporte informático externalizado, consigue el restablecimiento de la contraseña y el MFA de un empleado y, dos meses después, cifra los servidores de virtualización de una cadena minorista durante un puente largo. Se paran tiendas, venta online y almacenes, y se roban datos de clientes. El ejercicio pone a prueba cuándo una avería pasa a ser una crisis, la confianza en el soporte externalizado y la notificación a los clientes."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "new_threat",
      "annual_program"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
      "GDPR"
    ],
    "regulatory_framework_other": "",
    "capabilities": [
      "detection_triage_escalation",
      "regulatory_notification",
      "third_party_supply_chain"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Comité de crisis",
      "Operaciones de seguridad",
      "TI",
      "Operaciones de tiendas",
      "Comercio electrónico",
      "Comunicación",
      "Delegado de protección de datos",
      "Legal",
      "Guardia de TI",
      "CISO",
      "Responsable del soporte",
      "Director de TI",
      "Dirección de operaciones",
      "Responsable de comunicación"
    ],
    "third_parties": [
      "Soporte informático externalizado"
    ],
    "perimeter": "Tiendas, venta online, almacenes, el soporte externalizado y el comité de crisis.",
    "out_of_scope": "La negociación con los atacantes.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "EMPTY SHELF",
    "needs": [
      {
        "code": "NEED-01",
        "source": "incident_history",
        "title": "Los fallos de pago en tiendas se tratan como averías",
        "finding": "Nadie de guardia en fin de semana puede declarar una crisis de ciberseguridad.",
        "affected_capability": "detection_triage_escalation",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "risk_analysis",
        "title": "El soporte restablece el MFA con una llamada",
        "finding": "El soporte externalizado verifica a quien llama con datos que un atacante puede encontrar.",
        "affected_capability": "third_party_supply_chain",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "Notificación a clientes sin ensayar",
        "finding": "La cadena nunca ha notificado una brecha a millones de clientes.",
        "affected_capability": "regulatory_notification",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Crisis declarada y contenida",
        "statement": "La guardia convierte las averías de las tiendas en un incidente declarado en menos de 60 minutos, y el comité decide qué apagar.",
        "capability": "detection_triage_escalation",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Incidente declarado con un responsable\nDecisión de contención registrada",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Registro de guardia y actas del comité.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Confianza en el soporte restablecida",
        "statement": "Se suspenden los restablecimientos por teléfono, se acuerda con el proveedor una verificación más sólida y se vuelve a dar de alta el MFA de todos los administradores.",
        "capability": "third_party_supply_chain",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Restablecimientos por teléfono suspendidos\nNueva verificación acordada",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Correspondencia con el proveedor.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Clientes informados",
        "statement": "El equipo decide la notificación a la autoridad y el mensaje a los clientes afectados, sin tener todos los datos.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Notificación decidida\nAviso a clientes aprobado",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Registro de la brecha y aviso a clientes.",
        "regulatory_requirement_ids": [
          "GDPR-33-34"
        ]
      }
    ],
    "risks": [
      {
        "risk": "Ocurre un incidente real durante la sesión.",
        "mitigation": "Cualquiera puede detener el ejercicio con la palabra clave de parada."
      }
    ],
    "next_need_number": 4,
    "next_objective_number": 4
  },
  "msel": {
    "title": "Un puente sin cajas",
    "summary": "El sábado de un puente, las tiendas de {organization} informan de que fallan los pagos sin contacto y se pierden las reservas de recogida en tienda. La guardia de TI cree que es una avería.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "Sábado de puente",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Sábado de puente, 11:00. Las tiendas informan de fallos en los pagos con tarjeta.",
        "key_questions": [
          "¿Avería o ataque? ¿Quién decide en un festivo?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": false
          },
          {
            "code": "OBJ-02",
            "due": false
          }
        ],
        "headline": "Fallan las cajas en toda la cadena"
      },
      {
        "code": "PH-02",
        "name": "Cifrado",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 1440,
        "situation_update": "Domingo. Los servidores de virtualización están cifrados; los pedidos online fallan.",
        "key_questions": [
          "¿Apagamos del todo la venta online?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          },
          {
            "code": "OBJ-02",
            "due": true
          }
        ],
        "headline": "Los servidores están cifrados"
      },
      {
        "code": "PH-03",
        "name": "Datos de clientes",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 14400,
        "situation_update": "Diez días después. La investigación confirma que se llevaron datos de clientes.",
        "key_questions": [
          "¿Qué decimos a los clientes sin conocer todos los hechos?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "Se llevaron datos de clientes"
      }
    ],
    "threat_actors": [
      {
        "origin": "system",
        "origin_id": "G1015",
        "origin_name": "Scattered Spider",
        "code": "THR-01",
        "name": "Scattered Spider",
        "mitre_group_id": "G1015",
        "aliases": [],
        "description": "Grupo poco estructurado, experto en ingeniería social contra el soporte, que alquila una plataforma de ransomware.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1566.004"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1078"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1003.003"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1486"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1567"
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
        "title": "Fallan las cajas y la recogida en tienda",
        "content": "Un responsable regional de tiendas llama a la guardia de TI: fallan los pagos sin contacto en una docena de tiendas, desaparecen las reservas de recogida y las colas crecen. «¿Es otra vez el banco?».",
        "offset_minutes": 5,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-01",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Guardia de TI",
          "Operaciones de tiendas"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-01-A1",
            "description": "Escala más allá del soporte habitual y avisa al comité de crisis.",
            "responsible_role": "Guardia de TI",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": "system",
        "origin_id": "INJ-PHI-03",
        "origin_name": "Un ticket de MFA resuelto y un inicio de sesión extraño",
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Un restablecimiento de MFA hace dos meses",
        "content": "El SOC relaciona los sistemas que fallan con una cuenta de administrador. El soporte externalizado restableció su contraseña y su MFA hace dos meses tras una llamada; desde entonces ha iniciado sesión desde ubicaciones desconocidas y ha copiado la base de datos del directorio.",
        "offset_minutes": 25,
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
          "CISO"
        ],
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1566.004"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1078"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0006",
            "technique_id": "T1003.003"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01",
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Declara un incidente de ciberseguridad y nombra un responsable.",
            "responsible_role": "CISO",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-02-A2",
            "description": "Suspende los restablecimientos de contraseña y MFA por teléfono.",
            "responsible_role": "Responsable del soporte",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-03",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Cifrados los servidores de virtualización",
        "content": "Durante la noche se cifraron los servidores de virtualización, donde funcionan los sistemas de tienda, la tienda online y la gestión de almacenes. Hay una nota de rescate en cada consola.",
        "offset_minutes": 55,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-03",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Comité de crisis",
          "TI"
        ],
        "delivery_method": "document",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1486"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1490"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "Decide si apaga del todo la venta online para contener el ataque.",
            "responsible_role": "Comité de crisis",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-04",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "El proveedor de soporte se defiende",
        "content": "El responsable de cuenta del soporte externalizado: «Seguimos el procedimiento: quien llamó sabía el número de empleado y el nombre del responsable». Si les cortáis el acceso remoto, no pueden dar soporte a tiendas ni a la plantilla.",
        "offset_minutes": 80,
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
          "CISO",
          "Director de TI"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-04-A1",
            "description": "Acuerda una nueva verificación de llamadas y da de alta de nuevo el MFA de todos los administradores.",
            "responsible_role": "CISO",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-04-A2",
            "description": "Decide si corta el acceso remoto del proveedor.",
            "responsible_role": "Director de TI",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-05",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Se paran los almacenes y se vacían los estantes",
        "content": "La dirección de operaciones: la reposición está parada, 200 trabajadores de almacén no tienen nada que hacer y algunas tiendas se quedarán mañana sin productos frescos. ¿Qué funciona con procesos manuales?",
        "offset_minutes": 95,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-01",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Dirección de operaciones",
          "Comité de crisis"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-05-A1",
            "description": "Decide qué operaciones funcionan con procesos manuales.",
            "responsible_role": "Dirección de operaciones",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Se llevaron datos de clientes",
        "content": "El proveedor de respuesta a incidentes confirma el robo de datos de contacto, fechas de nacimiento e historiales de pedidos de clientes. No hay datos de tarjetas ni contraseñas.",
        "offset_minutes": 115,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-05",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Delegado de protección de datos",
          "Legal"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0010",
            "technique_id": "T1567"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-06-A1",
            "description": "Decide la notificación a la autoridad y a los clientes.",
            "responsible_role": "Delegado de protección de datos",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-07",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "El mismo grupo, otras cadenas",
        "content": "Un periodista: otras dos cadenas informan de ataques del mismo grupo. ¿Hay datos de clientes afectados en {organization} y cuándo volverá la venta online?",
        "offset_minutes": 140,
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
          "Responsable de comunicación",
          "Comité de crisis"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-07-A1",
            "description": "Aprueba el aviso a clientes y el comunicado público.",
            "responsible_role": "Responsable de comunicación",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      }
    ],
    "next_phase_number": 4,
    "next_inject_number": 8,
    "next_threat_actor_number": 2
  },
  "cast": [
    {
      "origin": "system",
      "origin_id": "insider",
      "origin_name": "Empleado",
      "code": "ACT-01",
      "name": "Empleado",
      "type": "internal",
      "description": "Un empleado que avisa de algo extraño, o el insider que está detrás.",
      "channel": "in_person"
    },
    {
      "origin": "system",
      "origin_id": "soc",
      "origin_name": "SOC",
      "code": "ACT-02",
      "name": "SOC",
      "type": "soc",
      "description": "El centro de operaciones de seguridad: alertas, hallazgos y peticiones de decisión.",
      "channel": "ticket"
    },
    {
      "origin": "system",
      "origin_id": "threat-actor",
      "origin_name": "Atacante (remitente)",
      "code": "ACT-03",
      "name": "Atacante (remitente)",
      "type": "threat_actor",
      "description": "Firma los mensajes del atacante: notas de rescate, publicaciones de filtraciones, plazos. Quién es el atacante, y sus técnicas, son los actores de amenaza del escenario.",
      "channel": "document"
    },
    {
      "origin": "system",
      "origin_id": "managed-service-provider",
      "origin_name": "Proveedor de servicios gestionados",
      "code": "ACT-04",
      "name": "Proveedor de servicios gestionados",
      "type": "supplier",
      "description": "El proveedor que gestiona parte de la infraestructura, quizá la vía de entrada.",
      "channel": "phone"
    },
    {
      "origin": "system",
      "origin_id": "dfir-provider",
      "origin_name": "Proveedor de respuesta a incidentes (retainer)",
      "code": "ACT-05",
      "name": "Proveedor de respuesta a incidentes (retainer)",
      "type": "supplier",
      "description": "El equipo externo de respuesta y forense, normalmente con un contrato (retainer) que se activa durante el incidente: hallazgos, informes y recomendaciones de contención.",
      "channel": "briefing"
    },
    {
      "origin": "system",
      "origin_id": "media",
      "origin_name": "Medios de comunicación",
      "code": "ACT-06",
      "name": "Medios de comunicación",
      "type": "media",
      "description": "Periodistas que preguntan o publican sobre el incidente.",
      "channel": "media"
    }
  ],
  "next_actor_number": 7,
  "tags": [
    {
      "origin": "system",
      "origin_id": "ransomware",
      "origin_name": "Ransomware",
      "name": "Ransomware",
      "color": "rose",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "phishing",
      "origin_name": "Phishing",
      "name": "Phishing",
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
      "origin_id": "gdpr",
      "origin_name": "RGPD",
      "name": "RGPD",
      "color": "slate",
      "custom_hex": null,
      "applied": true
    }
  ],
  "images": [],
  "uses_rooms": false,
  "rooms": [],
  "next_room_number": 1
}
```
