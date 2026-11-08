---
format: "ttx-zone.scenario"
format_version: 3
language: "es"
title: "Ayuntamiento cifrado"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Ayuntamiento cifrado

Un afiliado de ransomware entra en un ayuntamiento por el acceso remoto de un proveedor sin MFA y cifra servidores y copias de seguridad durante un fin de semana. Los servicios digitales se paran durante semanas y los datos de los vecinos se publican tras negarse el ayuntamiento a pagar. El ejercicio pone a prueba los servicios públicos esenciales en papel, las decisiones políticas y sobre el rescate, y la información a los vecinos.

> Escenario de TTX-Zone. Impórtalo desde Biblioteca → Escenarios. La parte legible se genera al exportar; solo se importa el bloque de datos del final.

## Objetivos

- **OBJ-01** Servicios esenciales en papel
- **OBJ-02** Decisiones sobre el rescate y políticas
- **OBJ-03** Vecinos informados

## Escenario

Lunes, 08:00. La plantilla de {organization} encuentra una nota de rescate en sus pantallas. La web y la sede electrónica están caídas; el equipo de TI son tres personas.

## Fases e injects

### PH-01 Lunes por la mañana

Lunes, 08:00. Una nota de rescate en cada pantalla.

- **INJ-01** (T+5′) Una nota de rescate en cada pantalla
- **INJ-02** (T+25′) Las copias también han caído
- **INJ-03** (T+40′) La exigencia de rescate

### PH-02 Ventanillas en papel

Jueves. Las ventanillas reabren con formularios en papel; la prensa local lo cubre a diario.

- **INJ-04** (T+55′) Las ayudas de emergencia vencen mañana
- **INJ-05** (T+85′) La oposición pide explicaciones

### PH-03 Datos de los vecinos

Dos semanas después. Se publican los datos de los vecinos.

- **INJ-06** (T+115′) Se publican los datos de los vecinos
- **INJ-07** (T+140′) Vecinos en la ventanilla

## Actores simulados

- **ACT-01** Empleado
- **ACT-02** Atacante (remitente)
- **ACT-03** CSIRT nacional
- **ACT-04** Medios de comunicación
- **ACT-05** Autoridad de protección de datos

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 3,
  "language": "es",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "Ayuntamiento cifrado",
    "description": "Un afiliado de ransomware entra en un ayuntamiento por el acceso remoto de un proveedor sin MFA y cifra servidores y copias de seguridad durante un fin de semana. Los servicios digitales se paran durante semanas y los datos de los vecinos se publican tras negarse el ayuntamiento a pagar. El ejercicio pone a prueba los servicios públicos esenciales en papel, las decisiones políticas y sobre el rescate, y la información a los vecinos."
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
      "continuity_recovery",
      "crisis_decision_making",
      "regulatory_notification"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Comité de crisis",
      "Alcaldía",
      "TI",
      "Servicios sociales",
      "Atención ciudadana",
      "Comunicación",
      "Delegado de protección de datos",
      "Responsable de TI",
      "Responsable de servicios sociales",
      "Responsable de comunicación"
    ],
    "third_parties": [
      "Proveedor de software",
      "CSIRT público"
    ],
    "perimeter": "Los servicios municipales, el equipo de TI, la alcaldía y la comunicación con los vecinos.",
    "out_of_scope": "La reconstrucción técnica de la red.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "CITY LIGHTS",
    "needs": [
      {
        "code": "NEED-01",
        "source": "risk_analysis",
        "title": "Copias de seguridad en la misma red",
        "finding": "Las copias pueden cifrarse con todo lo demás; no hay procedimiento en papel para los servicios esenciales.",
        "affected_capability": "continuity_recovery",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "incident_history",
        "title": "Escalado en fin de semana y postura sobre el rescate sin definir",
        "finding": "Nadie sabe quién decide en fin de semana ni cuál es la postura del ayuntamiento sobre pagar.",
        "affected_capability": "crisis_decision_making",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "Notificación a vecinos sin ensayar",
        "finding": "El ayuntamiento nunca ha informado a los vecinos de que sus datos pueden publicarse.",
        "affected_capability": "regulatory_notification",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Servicios esenciales en papel",
        "statement": "Nóminas, ayudas sociales de emergencia y registro civil siguen funcionando en papel mientras se reconstruyen los sistemas.",
        "capability": "continuity_recovery",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Servicios esenciales identificados\nProcedimientos en papel en marcha",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Registro de continuidad de servicios.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Decisiones sobre el rescate y políticas",
        "statement": "La alcaldía decide sobre el rescate y el apoyo externo con motivos registrados, y acuerda qué se dice en público y cuándo.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Decisión sobre el rescate y motivos registrados\nLínea pública acordada",
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
        "title": "Vecinos informados",
        "statement": "Se notifica la brecha y se informa a los vecinos, ofreciéndoles apoyo.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Notificación enviada\nCarta a los vecinos aprobada",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Registro de la brecha y carta a los vecinos.",
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
    "title": "Vuelta al papel",
    "summary": "Lunes, 08:00. La plantilla de {organization} encuentra una nota de rescate en sus pantallas. La web y la sede electrónica están caídas; el equipo de TI son tres personas.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "Lunes por la mañana",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Lunes, 08:00. Una nota de rescate en cada pantalla.",
        "key_questions": [
          "¿Quién decide? ¿Pagamos?"
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
        "headline": "Una nota de rescate en cada pantalla"
      },
      {
        "code": "PH-02",
        "name": "Ventanillas en papel",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 4320,
        "situation_update": "Jueves. Las ventanillas reabren con formularios en papel; la prensa local lo cubre a diario.",
        "key_questions": [
          "¿Qué servicios no pueden esperar?"
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
        "headline": "Ventanillas en papel y preguntas en el pleno"
      },
      {
        "code": "PH-03",
        "name": "Datos de los vecinos",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 14400,
        "situation_update": "Dos semanas después. Se publican los datos de los vecinos.",
        "key_questions": [
          "¿Cómo informamos a los vecinos?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "Se publican los datos de los vecinos"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Afiliado de ransomware",
        "mitre_group_id": null,
        "aliases": [],
        "description": "Afiliado de ransomware sin identificar que entró por el acceso remoto de un proveedor.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1133"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1078"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1021.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1486"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1490"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1567.002"
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
        "title": "Una nota de rescate en cada pantalla",
        "content": "La plantilla que llega al ayuntamiento encuentra una nota de rescate en las pantallas. La web y la sede electrónica están caídas; los primeros vecinos hacen cola en las ventanillas.",
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
          "Alcaldía",
          "Comité de crisis"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1486"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-01-A1",
            "description": "Convoca el comité de crisis.",
            "responsible_role": "Alcaldía",
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
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Las copias también han caído",
        "content": "El responsable de TI (un equipo de tres personas): las copias estaban en la misma red y están cifradas. El atacante entró por una cuenta de acceso remoto de un proveedor sin MFA.",
        "offset_minutes": 25,
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
          "TI",
          "Comité de crisis"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0003",
            "technique_id": "T1133"
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
          "OBJ-01",
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Corta el acceso remoto del proveedor.",
            "responsible_role": "Responsable de TI",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-02-A2",
            "description": "Solicita apoyo al CSIRT público.",
            "responsible_role": "Responsable de TI",
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
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "La exigencia de rescate",
        "content": "El correo de los atacantes: 300.000 en criptomoneda en cinco días o se publicarán los datos de los vecinos. «Mucho más barato que reconstruirlo todo».",
        "offset_minutes": 40,
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
          "Alcaldía",
          "Comité de crisis"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1657"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "Decide si paga y deja constancia de los motivos.",
            "responsible_role": "Alcaldía",
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
        "code": "INJ-04",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Las ayudas de emergencia vencen mañana",
        "content": "Servicios sociales: mañana vencen las ayudas de emergencia a familias vulnerables y el viernes hay que pagar las nóminas. Las aplicaciones están cifradas.",
        "offset_minutes": 55,
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
          "Servicios sociales",
          "Comité de crisis"
        ],
        "delivery_method": "in_person",
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
            "description": "Organiza procesos en papel para las ayudas de emergencia y las nóminas.",
            "responsible_role": "Responsable de servicios sociales",
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
        "code": "INJ-05",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "La oposición pide explicaciones",
        "content": "El periódico local cubre el incidente a diario y los concejales de la oposición piden un pleno extraordinario. ¿Ha pagado el ayuntamiento?",
        "offset_minutes": 85,
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
          "Alcaldía",
          "Responsable de comunicación"
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
            "code": "INJ-05-A1",
            "description": "Acuerda qué dice la alcaldía y cuándo.",
            "responsible_role": "Responsable de comunicación",
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
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Se publican los datos de los vecinos",
        "content": "El CSIRT público: la investigación confirma el robo de carpetas compartidas y bases de datos, y los datos de los vecinos han aparecido en el sitio de filtraciones del grupo.",
        "offset_minutes": 115,
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
          "Delegado de protección de datos",
          "Alcaldía"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0010",
            "technique_id": "T1567.002"
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
            "description": "Notifica a la autoridad de protección de datos.",
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
        "title": "Vecinos en la ventanilla",
        "content": "Atención ciudadana está desbordada: los vecinos preguntan si sus datos están en internet y qué deben hacer. La autoridad de protección de datos pregunta cómo se informará a los vecinos.",
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
          "Delegado de protección de datos",
          "Atención ciudadana"
        ],
        "delivery_method": "email",
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
            "description": "Envía cartas a los vecinos y ofrece vigilancia de identidad.",
            "responsible_role": "Delegado de protección de datos",
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
      "origin_id": "threat-actor",
      "origin_name": "Atacante (remitente)",
      "code": "ACT-02",
      "name": "Atacante (remitente)",
      "type": "threat_actor",
      "description": "Firma los mensajes del atacante: notas de rescate, publicaciones de filtraciones, plazos. Quién es el atacante, y sus técnicas, son los actores de amenaza del escenario.",
      "channel": "document"
    },
    {
      "origin": "system",
      "origin_id": "national-csirt",
      "origin_name": "CSIRT nacional",
      "code": "ACT-03",
      "name": "CSIRT nacional",
      "type": "csirt",
      "description": "El equipo nacional de respuesta a incidentes: pide notificaciones y comparte indicadores.",
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
      "origin_id": "data-protection-authority",
      "origin_name": "Autoridad de protección de datos",
      "code": "ACT-05",
      "name": "Autoridad de protección de datos",
      "type": "authority",
      "description": "La autoridad de control ante brechas de datos personales.",
      "channel": "email"
    }
  ],
  "next_actor_number": 6,
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
      "origin_id": "data-breach",
      "origin_name": "Fuga de datos",
      "name": "Fuga de datos",
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
