---
format: "ttx-zone.scenario"
format_version: 3
language: "es"
title: "Apagón nacional de causa desconocida"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Apagón nacional de causa desconocida

La red eléctrica nacional cae a mediodía sin aviso. {organization} no es el operador de la red: de repente depende de generadores, baterías y papel, y nadie conoce la causa durante horas. Todo el mundo pregunta si es un ciberataque. Sin un adversario al que perseguir, el ejercicio pone a prueba la continuidad, las decisiones con incertidumbre y la comunicación de crisis.

> Escenario de TTX-Zone. Impórtalo desde Biblioteca → Escenarios. La parte legible se genera al exportar; solo se importa el bloque de datos del final.

## Objetivos

- **OBJ-01** Servicios esenciales mantenidos
- **OBJ-02** Decisiones con incertidumbre
- **OBJ-03** Comunicación clara

## Escenario

Un día laborable, 12:33. La electricidad cae en todas partes a la vez. El centro de datos de {organization} pasa a generadores; las oficinas se quedan a oscuras y los teléfonos aún funcionan. En las redes sociales aparece la palabra «ciberataque» en cuestión de minutos.

## Fases e injects

### PH-01 Apagón

Un día laborable, 12:33. La electricidad cae en todas partes a la vez.

- **INJ-01** (T+5′) El centro de datos funciona con generadores
- **INJ-02** (T+25′) ¿Apagamos todo por si acaso?
- **INJ-03** (T+40′) ¿Nos vamos a casa?

### PH-02 Se agotan las baterías

15:30. Las redes móviles fallan; el combustible es el cuello de botella.

- **INJ-04** (T+55′) El combustible llega mañana
- **INJ-05** (T+80′) «¿Os han hackeado?»

### PH-03 Vuelve la electricidad

Noche. Las autoridades dicen que no hay indicios de ciberataque; la electricidad vuelve por regiones.

- **INJ-06** (T+115′) Sin indicios de ciberataque
- **INJ-07** (T+140′) ¿Cobrado dos veces?

## Actores simulados

- **ACT-01** Empleado
- **ACT-02** Proveedor crítico
- **ACT-03** Medios de comunicación
- **ACT-04** CSIRT nacional
- **ACT-05** Cliente

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 3,
  "language": "es",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "Apagón nacional de causa desconocida",
    "description": "La red eléctrica nacional cae a mediodía sin aviso. {organization} no es el operador de la red: de repente depende de generadores, baterías y papel, y nadie conoce la causa durante horas. Todo el mundo pregunta si es un ciberataque. Sin un adversario al que perseguir, el ejercicio pone a prueba la continuidad, las decisiones con incertidumbre y la comunicación de crisis."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "new_or_revised_plan",
      "annual_program"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [],
    "regulatory_framework_other": "",
    "capabilities": [
      "continuity_recovery",
      "crisis_decision_making",
      "internal_external_comms"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Comité de crisis",
      "Instalaciones",
      "TI",
      "Recursos Humanos",
      "Comunicación",
      "Dirección de operaciones",
      "Responsable de continuidad",
      "Director de TI",
      "Presidencia del comité de crisis",
      "Responsable de Recursos Humanos",
      "Responsable de comunicación"
    ],
    "third_parties": [
      "Proveedor de combustible"
    ],
    "perimeter": "La continuidad del negocio en todas las sedes, el centro de datos, la seguridad de la plantilla y la comunicación de crisis.",
    "out_of_scope": "La causa del apagón.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "BLACK SKY",
    "needs": [
      {
        "code": "NEED-01",
        "source": "risk_analysis",
        "title": "Los planes de continuidad dan por hecho que funcionan las telecomunicaciones",
        "finding": "Los planes dependen del teléfono e internet, y el combustible de los generadores dura ocho horas.",
        "affected_capability": "continuity_recovery",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "incident_history",
        "title": "Apagados preventivos sin criterios",
        "finding": "En cortes anteriores se apagaron sistemas «por si acaso» sin criterios acordados.",
        "affected_capability": "crisis_decision_making",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "risk_analysis",
        "title": "Sin mensaje para un incidente de causa desconocida",
        "finding": "No hay una línea acordada para hablar mientras se desconoce la causa.",
        "affected_capability": "internal_external_comms",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Servicios esenciales mantenidos",
        "statement": "El comité decide qué servicios funcionan con los generadores y durante cuánto tiempo, y asegura el repostaje.",
        "capability": "continuity_recovery",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Servicios prioritarios decididos\nRepostaje organizado",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Registro de continuidad.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Decisiones con incertidumbre",
        "statement": "El comité decide sobre los apagados preventivos y un arranque controlado, con criterios escritos.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Decisión de apagado y criterios registrados\nSecuencia de arranque acordada",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Actas del comité.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Comunicación clara",
        "statement": "Plantilla, clientes y público reciben un mensaje coherente que no especula sobre la causa.",
        "capability": "internal_external_comms",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Plantilla informada\nMensaje público aprobado",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Mensajes enviados.",
        "regulatory_requirement_ids": []
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
    "title": "Apagón a mediodía",
    "summary": "Un día laborable, 12:33. La electricidad cae en todas partes a la vez. El centro de datos de {organization} pasa a generadores; las oficinas se quedan a oscuras y los teléfonos aún funcionan. En las redes sociales aparece la palabra «ciberataque» en cuestión de minutos.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "Apagón",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Un día laborable, 12:33. La electricidad cae en todas partes a la vez.",
        "key_questions": [
          "¿Es un ciberataque? ¿Importa ahora mismo?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": false
          },
          {
            "code": "OBJ-02",
            "due": false
          },
          {
            "code": "OBJ-03",
            "due": false
          }
        ],
        "headline": "No hay electricidad en ninguna parte"
      },
      {
        "code": "PH-02",
        "name": "Se agotan las baterías",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 180,
        "situation_update": "15:30. Las redes móviles fallan; el combustible es el cuello de botella.",
        "key_questions": [
          "¿Qué mantenemos vivo con el combustible que hay?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          },
          {
            "code": "OBJ-03",
            "due": false
          }
        ],
        "headline": "Fallan los teléfonos y escasea el combustible"
      },
      {
        "code": "PH-03",
        "name": "Vuelve la electricidad",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 600,
        "situation_update": "Noche. Las autoridades dicen que no hay indicios de ciberataque; la electricidad vuelve por regiones.",
        "key_questions": [
          "¿Arrancamos todo a la vez o por fases?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": true
          },
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "Vuelve la electricidad"
      }
    ],
    "threat_actors": [],
    "injects": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-01",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "El centro de datos funciona con generadores",
        "content": "Instalaciones: no hay suministro en ninguna sede. El centro de datos funciona con generadores y combustible para unas ocho horas; oficinas y ascensores sin corriente; dos personas atrapadas en un ascensor.",
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
          "Responsable de continuidad",
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
            "code": "INJ-01-A1",
            "description": "Activa el plan de continuidad y fija prioridades para la energía de los generadores.",
            "responsible_role": "Responsable de continuidad",
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
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "¿Apagamos todo por si acaso?",
        "content": "La dirección de TI: en redes sociales dicen que es un ciberataque. Algunas empresas están apagando sus sistemas. «¿Lo apagamos todo hasta saber qué pasa?».",
        "offset_minutes": 25,
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
          "Comité de crisis",
          "Director de TI"
        ],
        "delivery_method": "chat",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Decide sobre el apagado preventivo y deja escritos los criterios.",
            "responsible_role": "Presidencia del comité de crisis",
            "expected_within_minutes": 15,
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
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "¿Nos vamos a casa?",
        "content": "La plantilla pregunta si se va a casa. Los trenes están parados, los semáforos apagados y algunos compañeros viven lejos.",
        "offset_minutes": 40,
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
          "Recursos Humanos"
        ],
        "delivery_method": "in_person",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "Indica a la plantilla si se va a casa, se queda o se resguarda, y cómo mantenerse en contacto.",
            "responsible_role": "Responsable de Recursos Humanos",
            "expected_within_minutes": 15,
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
        "code": "INJ-04",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "El combustible llega mañana",
        "content": "El proveedor de combustible: todos los clientes piden repostar a la vez; la primera entrega posible es mañana por la mañana.",
        "offset_minutes": 55,
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
          "Comité de crisis",
          "Responsable de continuidad"
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
            "code": "INJ-04-A1",
            "description": "Decide qué servicios siguen funcionando con el combustible que queda.",
            "responsible_role": "Comité de crisis",
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
        "code": "INJ-05",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "«¿Os han hackeado?»",
        "content": "Un periodista, con la línea entrecortada: los clientes no consiguen contactar con {organization} y una publicación viral dice que han hackeado sus sistemas. ¿Es un ciberataque?",
        "offset_minutes": 80,
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
            "code": "INJ-05-A1",
            "description": "Aprueba un mensaje que no especula sobre la causa.",
            "responsible_role": "Responsable de comunicación",
            "expected_within_minutes": 15,
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
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Sin indicios de ciberataque",
        "content": "El CSIRT nacional: por ahora no hay indicios de ciberataque; el suministro se restablece por regiones. Recomienda arrancar los sistemas de forma controlada y comprobar su integridad.",
        "offset_minutes": 115,
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
          "Director de TI",
          "Comité de crisis"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-06-A1",
            "description": "Decide la secuencia de arranque y las comprobaciones de integridad.",
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
        "code": "INJ-07",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "¿Cobrado dos veces?",
        "content": "Escriben clientes: las operaciones iniciadas durante el apagón aparecen pendientes o cobradas dos veces.",
        "offset_minutes": 140,
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
          "Dirección de operaciones",
          "Comunicación"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02",
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-07-A1",
            "description": "Concilia las operaciones antes de reabrir los servicios.",
            "responsible_role": "Dirección de operaciones",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-07-A2",
            "description": "Explica a los clientes qué pasa con sus operaciones pendientes.",
            "responsible_role": "Responsable de comunicación",
            "expected_within_minutes": 30,
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
    "next_threat_actor_number": 1
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
      "origin_id": "critical-supplier",
      "origin_name": "Proveedor crítico",
      "code": "ACT-02",
      "name": "Proveedor crítico",
      "type": "supplier",
      "description": "Un proveedor del que depende el negocio, afectado o implicado en el incidente.",
      "channel": "phone"
    },
    {
      "origin": "system",
      "origin_id": "media",
      "origin_name": "Medios de comunicación",
      "code": "ACT-03",
      "name": "Medios de comunicación",
      "type": "media",
      "description": "Periodistas que preguntan o publican sobre el incidente.",
      "channel": "media"
    },
    {
      "origin": "system",
      "origin_id": "national-csirt",
      "origin_name": "CSIRT nacional",
      "code": "ACT-04",
      "name": "CSIRT nacional",
      "type": "csirt",
      "description": "El equipo nacional de respuesta a incidentes: pide notificaciones y comparte indicadores.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "customer",
      "origin_name": "Cliente",
      "code": "ACT-05",
      "name": "Cliente",
      "type": "customer",
      "description": "Un cliente que nota el impacto y pide explicaciones.",
      "channel": "email"
    }
  ],
  "next_actor_number": 6,
  "tags": [
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
      "origin_id": "executive",
      "origin_name": "Directivo",
      "name": "Directivo",
      "color": "indigo",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "plan-validation",
      "origin_name": "Validación de plan",
      "name": "Validación de plan",
      "color": "moss",
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
