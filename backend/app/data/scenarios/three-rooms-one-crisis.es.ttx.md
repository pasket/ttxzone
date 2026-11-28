---
format: "ttx-zone.scenario"
format_version: 9
language: "es"
title: "Tres salas, una crisis"
exported_at: "2026-11-28T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "20.1"
---

# Tres salas, una crisis

Una dependencia de código abierto envenenada en la plataforma regional de servicios a la ciudadanía deja sin sede electrónica a decenas de ayuntamientos. Un ayuntamiento, la agencia regional y la empresa de aguas deciden cada uno en su sala con una parte de la información, y después tienen que hablar con una sola voz.

> Plantilla de ejercicio de TTX-Zone. Impórtala desde Biblioteca → Plantillas de ejercicio. La parte legible se genera al exportar; solo se importa el bloque de datos del final.

## Objetivos

- **OBJ-01** Servicios esenciales en papel
- **OBJ-02** Una sola imagen de la situación
- **OBJ-03** Notificar a tiempo, hablar una vez

## Escenario

Martes, 09:05. En {region}, {digital_agency} opera la plataforma de servicios a la ciudadanía de {town_hall_count} ayuntamientos: la sede electrónica, el padrón y un asistente de IA. {water_utility} aloja en ella su portal de clientes. Durante la noche, una compilación descargó una dependencia de código abierto manipulada.

## Fases e injects

### PH-01 Un martes cualquiera

Martes, 09:05. Una mañana cualquiera en las tres administraciones.

- **INJ-01** (T+5′) Una dependencia que lee demasiado
- **INJ-02** (T+12′) Están leyendo el padrón
- **POL-03** (T+17′) La plataforma
  - ¿Apagas la plataforma para todos los ayuntamientos?
    - Apagarla ya, para los {town_hall_count}
      - El actor pierde la plataforma al instante. Todos los ayuntamientos pasan al papel en una hora, y la mayoría se entera por su propio personal.
    - Mantenerla en marcha bajo vigilancia y anular las claves robadas
      - Los servicios continúan y averiguas qué busca el actor. Si salen datos mientras miras, tendrás que explicar por qué.
    - Apagar solo el padrón y el asistente
      - Se cierra el camino conocido y la sede electrónica sigue en pie. Lo que no sabías que estaba conectado sigue conectado.
- **INJ-04** (T+12′) Las ayudas de emergencia se pagan mañana
- **POL-05** (T+17′) Los pagos
  - ¿Pagas las ayudas de emergencia de mañana sin el padrón?
    - Pagar a todos los de la lista del mes pasado, en papel
      - Las familias reciben su ayuda a tiempo. Algunos pagos serán incorrectos, y la intervención preguntará quién firmó.
    - Aplazar hasta que vuelva el padrón
      - Todos los pagos serán correctos. {aid_households} hogares esperan, y nadie sabe decir cuánto.
    - Los trabajadores sociales confirman los casos que conocen y se pagan esos
      - Los casos más urgentes se pagan mañana. Tres personas no pueden confirmar {aid_households} hogares en un día.
- **INJ-06** (T+12′) El mismo inicio de sesión, otro sistema
- **POL-07** (T+17′) El aviso
  - ¿Emites un aviso preventivo a los vecinos?
    - Emitir ya un aviso preventivo
      - Los vecinos se enteran primero por ti. A mediodía los supermercados se quedan sin agua embotellada, y el ayuntamiento se entera por la radio.
    - Pasar la planta a operación manual y no decir nada todavía
      - Las lecturas se comprueban a mano y el agua es segura. Si se filtra que dudaste y callaste, la noticia es el silencio.
    - Esperar a tener pruebas antes de hacer nada
      - Sin alarma y sin coste. Si las lecturas se tocaron, tuviste el aviso y no hiciste nada.

### PH-02 Tres mensajes

Martes, 13:00. La plataforma lleva cuatro horas bajo ataque y cada administración ha tomado su propia decisión.

- **INJ-08** (T+45′) La radio regional está al teléfono
- **INJ-09** (contingente) Tres respuestas en antena
- **INJ-10** (T+65′) El CSIRT nacional pregunta

### PH-03 Una sola voz

Jueves, 10:00. Dos días después, aparecen en internet datos de los vecinos.

- **INJ-11** (T+90′) Una muestra del padrón está en internet
- **POL-12** (T+95′) Quién habla
  - Los vecinos de {town_hall_count} municipios preguntan. ¿Quién se lo cuenta, y cómo?
    - Un portavoz conjunto y una declaración para las tres
      - Los vecinos oyen una sola versión. Acordarla lleva dos horas, y quien sale ante la cámara no es la alcaldía.
    - Cada administración habla, con mensajes acordados
      - Cada alcaldía responde a sus vecinos. Al segundo día, {town_hall_count} voces ya no dicen lo mismo.
    - Presentar lo que exige la ley y no añadir nada
      - Impecable en lo legal. La historia la cuenta quien publicó en el foro.
- **DSC-13** (T+110′) Hot wash

## Actores simulados

- **ACT-01** SOC de la agencia
- **ACT-02** Operaciones de plataforma
- **ACT-03** Servicios sociales
- **ACT-04** Operaciones de planta
- **ACT-05** Medios de comunicación
- **ACT-06** CSIRT nacional
- **ACT-07** Control del ejercicio

## Placeholders

- `{region}` La región a la que pertenecen las tres administraciones. (p. ej. Valdoria)
- `{digital_agency}` La agencia regional que opera la plataforma compartida de servicios a la ciudadanía. Como nombre, sin artículo. (p. ej. Valdoria Digital)
- `{town}` El municipio cuyo ayuntamiento juega en la primera sala. (p. ej. Sotoverde)
- `{water_utility}` La empresa de aguas que aloja su portal de clientes en la plataforma. Como nombre, sin artículo. (p. ej. Aguas de Valdoria)
- `{town_hall_count}` Cuántos ayuntamientos dependen de la plataforma, en cifra. (p. ej. 62)
- `{aid_households}` Cuántos hogares cobran mañana la ayuda de emergencia, en cifra. (p. ej. 340)
- `{leaked_records}` Cuántos registros de vecinos aparecen en la muestra filtrada, en cifra. (p. ej. 2.000)

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 9,
  "language": "es",
  "exported_at": "2026-11-28T00:00:00Z",
  "exercise": {
    "name": "Tres salas, una crisis",
    "description": "Una dependencia de código abierto envenenada en la plataforma regional de servicios a la ciudadanía deja sin sede electrónica a decenas de ayuntamientos. Un ayuntamiento, la agencia regional y la empresa de aguas deciden cada uno en su sala con una parte de la información, y después tienen que hablar con una sola voz."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "new_threat",
      "annual_program"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
      "NIS2",
      "GDPR"
    ],
    "regulatory_framework_other": "",
    "capabilities": [
      "continuity_recovery",
      "cross_unit_coordination",
      "regulatory_notification"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Alcaldía",
      "Servicios sociales",
      "Informática municipal",
      "Dirección de la agencia",
      "CISO de la agencia",
      "Operaciones de plataforma",
      "Gabinete del gobierno regional",
      "Dirección de la empresa de aguas",
      "Operaciones de planta",
      "Comunicación"
    ],
    "third_parties": [
      "CSIRT nacional",
      "Medios de comunicación"
    ],
    "perimeter": "Las células de crisis del Ayuntamiento de {town}, de {digital_agency} y de {water_utility}, y las decisiones que comparten.",
    "out_of_scope": "La recuperación técnica de la plataforma.",
    "max_duration_hours": 2,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "MUNDO REAL",
    "needs": [
      {
        "code": "NEED-01",
        "source": "risk_analysis",
        "title": "Los servicios esenciales dependen de una plataforma compartida",
        "finding": "Los servicios esenciales a los vecinos dependen de una plataforma que el ayuntamiento no opera, y no hay una forma ensayada de prestarlos sin ella.",
        "affected_capability": "continuity_recovery",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "incident_history",
        "title": "Nunca se ha ensayado una decisión conjunta",
        "finding": "Nunca se ha ensayado una decisión que afecte a varias administraciones a la vez.",
        "affected_capability": "cross_unit_coordination",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "Nadie es responsable de notificar un incidente compartido",
        "finding": "No está acordado quién notifica ni quién habla cuando el incidente es de tres administraciones.",
        "affected_capability": "regulatory_notification",
        "priority": "high"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Servicios esenciales en papel",
        "statement": "Cada administración decide en 20 minutos cómo sigue prestando su servicio esencial a los vecinos sin la plataforma, y nombra a quien responde de ello.",
        "capability": "continuity_recovery",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Cada sala decide cómo continúa su servicio esencial\nCada decisión tiene un responsable con nombre\nLa decisión se toma en los 20 minutos siguientes al inject",
        "achieve_at_least": null,
        "time_box_minutes": 20,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Registro de decisiones de cada sala.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Una sola imagen de la situación",
        "statement": "Las tres administraciones acuerdan una imagen común de la situación y una declaración única en los 15 minutos siguientes a la primera petición de los medios.",
        "capability": "cross_unit_coordination",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Las tres administraciones hablan entre sí antes de contestar a los medios\nSe acuerda una declaración, con un portavoz con nombre\nOcurre en los 15 minutos siguientes a la petición",
        "achieve_at_least": null,
        "time_box_minutes": 15,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Registro de decisiones y la declaración.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Notificar a tiempo, hablar una vez",
        "statement": "Un responsable con nombre presenta la alerta temprana dentro del plazo de 24 horas, y los vecinos reciben un único mensaje coherente.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Un responsable con nombre presenta la alerta temprana en 24 horas\nEl ayuntamiento y la empresa de aguas confirman quién notifica por ellos\nLos vecinos reciben un único mensaje coherente",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Registro de la notificación y la declaración pública.",
        "regulatory_requirement_ids": [
          "NIS2-23"
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
    "title": "Tres salas, una crisis",
    "summary": "Martes, 09:05. En {region}, {digital_agency} opera la plataforma de servicios a la ciudadanía de {town_hall_count} ayuntamientos: la sede electrónica, el padrón y un asistente de IA. {water_utility} aloja en ella su portal de clientes. Durante la noche, una compilación descargó una dependencia de código abierto manipulada.",
    "attack_version": "20.1",
    "duration_minutes": 120,
    "time_compression": 1,
    "phases": [
      {
        "code": "PH-01",
        "name": "Un martes cualquiera",
        "start_offset": 0,
        "end_offset": 40,
        "incident_jump_minutes": 0,
        "situation_update": "Martes, 09:05. Una mañana cualquiera en las tres administraciones.",
        "key_questions": [
          "¿Quién decide por tu administración?",
          "¿Quién más necesita saber lo que acabas de decidir?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          }
        ],
        "headline": "Una dependencia que lee demasiado"
      },
      {
        "code": "PH-02",
        "name": "Tres mensajes",
        "start_offset": 40,
        "end_offset": 85,
        "incident_jump_minutes": 195,
        "situation_update": "Martes, 13:00. La plataforma lleva cuatro horas bajo ataque y cada administración ha tomado su propia decisión.",
        "key_questions": [
          "¿Quién habla por las tres?",
          "¿Quién presenta la alerta temprana, y por quién?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": true
          },
          {
            "code": "OBJ-03",
            "due": false
          }
        ],
        "headline": "Los medios preguntan y el reloj corre"
      },
      {
        "code": "PH-03",
        "name": "Una sola voz",
        "start_offset": 85,
        "end_offset": 120,
        "incident_jump_minutes": 2655,
        "situation_update": "Jueves, 10:00. Dos días después, aparecen en internet datos de los vecinos.",
        "key_questions": [
          "¿Quién se lo cuenta a los vecinos, y cómo?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": false
          },
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "Los datos de los vecinos están en internet"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Actor sin identificar",
        "mitre_group_id": null,
        "aliases": [],
        "description": "Un actor que llegó a las cuentas cloud de la plataforma a través de una dependencia de código abierto manipulada en una compilación.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1195.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1078.004"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1087.004"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1530"
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
        "title": "Una dependencia que lee demasiado",
        "content": "La compilación del asistente de IA para vecinos descargó anoche una dependencia de código abierto manipulada. Las claves de acceso cloud de ese pipeline se están usando desde una dirección que no conocemos.",
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
          "CISO de la agencia",
          "Alcaldía",
          "Dirección de la empresa de aguas"
        ],
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1195.001"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1078.004"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-01-A1",
            "description": "Cada sala nombra a quien decide por ella.",
            "responsible_role": "Dirección de la agencia",
            "expected_within_minutes": 10,
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
        "title": "Están leyendo el padrón",
        "content": "El actor está listando la base de datos del padrón. Apagar la plataforma detiene la sede electrónica de {town_hall_count} ayuntamientos.",
        "offset_minutes": 12,
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
          "Dirección de la agencia",
          "CISO de la agencia"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0007",
            "technique_id": "T1087.004"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Decide qué pasa con la plataforma y avisa a los ayuntamientos.",
            "responsible_role": "Dirección de la agencia",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": [
          "RM-02"
        ],
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
        "code": "POL-03",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "La plataforma",
        "content": "El actor está dentro de la plataforma y {town_hall_count} ayuntamientos dependen de ella.",
        "offset_minutes": 17,
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
        "facilitator_notes": "Cierra la votación confirmando la opción que eligió la sala y muestra el resultado: la sala lee su consecuencia. El siguiente inject funciona gane la opción que gane. Cada decisión suma en los medidores: muestra su resumen en el hot wash.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [
          "RM-02"
        ],
        "files": [],
        "artifact": null,
        "format": "poll",
        "poll_question": "¿Apagas la plataforma para todos los ayuntamientos?",
        "poll_options": [
          "Apagarla ya, para los {town_hall_count}",
          "Mantenerla en marcha bajo vigilancia y anular las claves robadas",
          "Apagar solo el padrón y el asistente"
        ],
        "poll_outcomes": [
          "El actor pierde la plataforma al instante. Todos los ayuntamientos pasan al papel en una hora, y la mayoría se entera por su propio personal.",
          "Los servicios continúan y averiguas qué busca el actor. Si salen datos mientras miras, tendrás que explicar por qué.",
          "Se cierra el camino conocido y la sede electrónica sigue en pie. Lo que no sabías que estaba conectado sigue conectado."
        ],
        "poll_impacts": [
          {
            "m1": 3,
            "m2": 1,
            "m3": 1,
            "m4": 3
          },
          {
            "m1": 1,
            "m2": 2,
            "m3": 3,
            "m4": 2
          },
          {
            "m1": 2,
            "m2": 1,
            "m3": 2,
            "m4": 2
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-04",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Las ayudas de emergencia se pagan mañana",
        "content": "La sede electrónica y el padrón no responden. Mañana se pagan las ayudas de emergencia de {aid_households} hogares, y el derecho a recibirlas se comprueba en el padrón.",
        "offset_minutes": 12,
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
          "Alcaldía",
          "Servicios sociales"
        ],
        "delivery_method": "in_person",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-04-A1",
            "description": "Decide cómo se pagan las ayudas de mañana y quién lo firma.",
            "responsible_role": "Alcaldía",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": [
          "RM-01"
        ],
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
        "code": "POL-05",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Los pagos",
        "content": "El padrón está caído y las ayudas se pagan mañana.",
        "offset_minutes": 17,
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
        "facilitator_notes": "Cierra la votación confirmando la opción que eligió la sala y muestra el resultado: la sala lee su consecuencia. El siguiente inject funciona gane la opción que gane. Cada decisión suma en los medidores: muestra su resumen en el hot wash.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [
          "RM-01"
        ],
        "files": [],
        "artifact": null,
        "format": "poll",
        "poll_question": "¿Pagas las ayudas de emergencia de mañana sin el padrón?",
        "poll_options": [
          "Pagar a todos los de la lista del mes pasado, en papel",
          "Aplazar hasta que vuelva el padrón",
          "Los trabajadores sociales confirman los casos que conocen y se pagan esos"
        ],
        "poll_outcomes": [
          "Las familias reciben su ayuda a tiempo. Algunos pagos serán incorrectos, y la intervención preguntará quién firmó.",
          "Todos los pagos serán correctos. {aid_households} hogares esperan, y nadie sabe decir cuánto.",
          "Los casos más urgentes se pagan mañana. Tres personas no pueden confirmar {aid_households} hogares en un día."
        ],
        "poll_impacts": [
          {
            "m1": 1,
            "m2": 1,
            "m3": 2,
            "m4": 2
          },
          {
            "m1": 3,
            "m2": 3,
            "m3": 1,
            "m4": 1
          },
          {
            "m1": 2,
            "m2": 2,
            "m3": 1,
            "m4": 3
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-06",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "El mismo inicio de sesión, otro sistema",
        "content": "Nuestro portal de clientes funciona sobre la plataforma de la agencia, y el personal de planta entra en la monitorización remota con el mismo proveedor de identidad. Las lecturas parecen normales. No podemos demostrar que nadie las haya tocado.",
        "offset_minutes": 12,
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
          "Dirección de la empresa de aguas",
          "Operaciones de planta"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-06-A1",
            "description": "Decide cómo se opera la planta hasta que las lecturas sean fiables.",
            "responsible_role": "Dirección de la empresa de aguas",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": [
          "RM-03"
        ],
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
        "code": "POL-07",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "El aviso",
        "content": "Las lecturas parecen normales y nadie puede responder de ellas.",
        "offset_minutes": 17,
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
        "facilitator_notes": "Cierra la votación confirmando la opción que eligió la sala y muestra el resultado: la sala lee su consecuencia. El siguiente inject funciona gane la opción que gane. Cada decisión suma en los medidores: muestra su resumen en el hot wash.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [
          "RM-03"
        ],
        "files": [],
        "artifact": null,
        "format": "poll",
        "poll_question": "¿Emites un aviso preventivo a los vecinos?",
        "poll_options": [
          "Emitir ya un aviso preventivo",
          "Pasar la planta a operación manual y no decir nada todavía",
          "Esperar a tener pruebas antes de hacer nada"
        ],
        "poll_outcomes": [
          "Los vecinos se enteran primero por ti. A mediodía los supermercados se quedan sin agua embotellada, y el ayuntamiento se entera por la radio.",
          "Las lecturas se comprueban a mano y el agua es segura. Si se filtra que dudaste y callaste, la noticia es el silencio.",
          "Sin alarma y sin coste. Si las lecturas se tocaron, tuviste el aviso y no hiciste nada."
        ],
        "poll_impacts": [
          {
            "m1": 2,
            "m2": 2,
            "m3": 1,
            "m4": 3
          },
          {
            "m1": 1,
            "m2": 3,
            "m3": 2,
            "m4": 2
          },
          {
            "m1": 1,
            "m2": 3,
            "m3": 3,
            "m4": 1
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-08",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "La radio regional está al teléfono",
        "content": "Entramos en antena a las 14:00. ¿Está caída la plataforma, se pagan mañana las ayudas y es segura el agua? Una sola respuesta, por favor.",
        "offset_minutes": 45,
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
          "Comunicación",
          "Alcaldía",
          "Gabinete del gobierno regional",
          "Dirección de la empresa de aguas"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "A partir de aquí, proyecta cada inject en la sala principal con todos juntos.",
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-08-A1",
            "description": "Las tres administraciones acuerdan una declaración única antes de contestar.",
            "responsible_role": "Comunicación",
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
        "code": "INJ-09",
        "phase_code": "PH-02",
        "kind": "contingent",
        "title": "Tres respuestas en antena",
        "content": "Ayuntamiento: «mañana vuelve». Región: «apagada hasta nuevo aviso». Empresa de aguas: sin comentarios.",
        "offset_minutes": null,
        "trigger_condition": "No hay una declaración única 15 minutos después de INJ-08.",
        "contingent_purpose": "Enseñar a la mesa cómo se ven desde fuera tres respuestas distintas.",
        "fires_at_minute": 20,
        "branch_from_code": "INJ-08",
        "branch_action_code": "INJ-08-A1",
        "rejoin_code": "INJ-10",
        "sender_code": "ACT-05",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Comunicación",
          "Alcaldía",
          "Gabinete del gobierno regional",
          "Dirección de la empresa de aguas"
        ],
        "delivery_method": "media",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-09-A1",
            "description": "Nombra un único portavoz y corrige los tres mensajes.",
            "responsible_role": "Gabinete del gobierno regional",
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
        "code": "INJ-10",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "El CSIRT nacional pregunta",
        "content": "Tenemos avisos de tres entidades sobre lo que parece un mismo incidente. ¿Quién presenta la alerta temprana, y por quién?",
        "offset_minutes": 65,
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
          "CISO de la agencia",
          "Alcaldía",
          "Dirección de la empresa de aguas"
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
            "code": "INJ-10-A1",
            "description": "Un responsable con nombre presenta la alerta temprana dentro del plazo de 24 horas.",
            "responsible_role": "CISO de la agencia",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-10-A2",
            "description": "El ayuntamiento y la empresa de aguas confirman quién notifica por ellos.",
            "responsible_role": "Alcaldía",
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
        "code": "INJ-11",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Una muestra del padrón está en internet",
        "content": "Una muestra de {leaked_records} registros de vecinos de {region} está en un foro de filtraciones. Quien la publica dice que hay más.",
        "offset_minutes": 90,
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
          "CISO de la agencia",
          "Alcaldía",
          "Comunicación"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0009",
            "technique_id": "T1530"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-11-A1",
            "description": "Decide quién se lo cuenta a los vecinos, y con qué mensaje.",
            "responsible_role": "Gabinete del gobierno regional",
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
        "code": "POL-12",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Quién habla",
        "content": "Los datos de los vecinos están en internet y a {town_hall_count} ayuntamientos les están preguntando.",
        "offset_minutes": 95,
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
        "facilitator_notes": "Proyéctala en la sala principal con todos juntos. Cierra la votación confirmando la opción elegida y muestra el resultado: la mesa lee su consecuencia. Cada decisión suma en los medidores: muestra su resumen en el hot wash.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "poll",
        "poll_question": "Los vecinos de {town_hall_count} municipios preguntan. ¿Quién se lo cuenta, y cómo?",
        "poll_options": [
          "Un portavoz conjunto y una declaración para las tres",
          "Cada administración habla, con mensajes acordados",
          "Presentar lo que exige la ley y no añadir nada"
        ],
        "poll_outcomes": [
          "Los vecinos oyen una sola versión. Acordarla lleva dos horas, y quien sale ante la cámara no es la alcaldía.",
          "Cada alcaldía responde a sus vecinos. Al segundo día, {town_hall_count} voces ya no dicen lo mismo.",
          "Impecable en lo legal. La historia la cuenta quien publicó en el foro."
        ],
        "poll_impacts": [
          {
            "m1": 1,
            "m2": 1,
            "m3": 1,
            "m4": 2
          },
          {
            "m1": 1,
            "m2": 2,
            "m3": 2,
            "m4": 3
          },
          {
            "m1": 1,
            "m2": 3,
            "m3": 1,
            "m4": 1
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "DSC-13",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Hot wash",
        "content": "¿Qué harías de otra forma en la primera hora?",
        "offset_minutes": 110,
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
          "Alcaldía",
          "Dirección de la agencia",
          "Dirección de la empresa de aguas"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Anota cada mejora con su responsable para el informe posterior.",
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
    "next_phase_number": 4,
    "next_inject_number": 14,
    "next_threat_actor_number": 2,
    "meters": [
      {
        "key": "m1",
        "name": "Servicio a los vecinos"
      },
      {
        "key": "m2",
        "name": "Confianza pública"
      },
      {
        "key": "m3",
        "name": "Exposición legal"
      },
      {
        "key": "m4",
        "name": "Carga de los equipos"
      }
    ]
  },
  "cast": [
    {
      "origin": "system",
      "origin_id": "soc",
      "origin_name": "SOC",
      "code": "ACT-01",
      "name": "SOC de la agencia",
      "type": "soc",
      "description": "El centro de operaciones de seguridad de la agencia.",
      "channel": "ticket"
    },
    {
      "origin": null,
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-02",
      "name": "Operaciones de plataforma",
      "type": "internal",
      "description": "El equipo que opera la plataforma.",
      "channel": "phone"
    },
    {
      "origin": null,
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-03",
      "name": "Servicios sociales",
      "type": "internal",
      "description": "Los servicios sociales del ayuntamiento.",
      "channel": "in_person"
    },
    {
      "origin": null,
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-04",
      "name": "Operaciones de planta",
      "type": "internal",
      "description": "Las operaciones de planta de la empresa de aguas.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "media",
      "origin_name": "Medios de comunicación",
      "code": "ACT-05",
      "name": "Medios de comunicación",
      "type": "media",
      "description": "La radio regional y la prensa local.",
      "channel": "phone"
    },
    {
      "origin": "system",
      "origin_id": "national-csirt",
      "origin_name": "CSIRT nacional",
      "code": "ACT-06",
      "name": "CSIRT nacional",
      "type": "csirt",
      "description": "El equipo nacional de respuesta a incidentes.",
      "channel": "email"
    },
    {
      "origin": null,
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-07",
      "name": "Control del ejercicio",
      "type": "other",
      "description": "La voz del propio ejercicio: las sesiones informativas y el hot wash.",
      "channel": "briefing"
    }
  ],
  "next_actor_number": 8,
  "tags": [
    {
      "origin": "system",
      "origin_id": "supply-chain",
      "origin_name": "Cadena de suministro",
      "name": "Cadena de suministro",
      "color": "rose",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "cloud",
      "origin_name": "Cloud",
      "name": "Cloud",
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
      "origin_id": "communications",
      "origin_name": "Comunicación",
      "name": "Comunicación",
      "color": "indigo",
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
  "uses_rooms": true,
  "rooms": [
    {
      "code": "RM-01",
      "name": "Ayuntamiento",
      "description": "El Ayuntamiento de {town}: la célula de crisis de la alcaldía."
    },
    {
      "code": "RM-02",
      "name": "Gobierno regional",
      "description": "{digital_agency} y el gabinete del gobierno regional."
    },
    {
      "code": "RM-03",
      "name": "Empresa de aguas",
      "description": "{water_utility}: dirección y operaciones de planta."
    }
  ],
  "next_room_number": 4,
  "files": [],
  "placeholders": [
    {
      "name": "region",
      "description": "La región a la que pertenecen las tres administraciones.",
      "suggested": "Valdoria"
    },
    {
      "name": "digital_agency",
      "description": "La agencia regional que opera la plataforma compartida de servicios a la ciudadanía. Como nombre, sin artículo.",
      "suggested": "Valdoria Digital"
    },
    {
      "name": "town",
      "description": "El municipio cuyo ayuntamiento juega en la primera sala.",
      "suggested": "Sotoverde"
    },
    {
      "name": "water_utility",
      "description": "La empresa de aguas que aloja su portal de clientes en la plataforma. Como nombre, sin artículo.",
      "suggested": "Aguas de Valdoria"
    },
    {
      "name": "town_hall_count",
      "description": "Cuántos ayuntamientos dependen de la plataforma, en cifra.",
      "suggested": "62"
    },
    {
      "name": "aid_households",
      "description": "Cuántos hogares cobran mañana la ayuda de emergencia, en cifra.",
      "suggested": "340"
    },
    {
      "name": "leaked_records",
      "description": "Cuántos registros de vecinos aparecen en la muestra filtrada, en cifra.",
      "suggested": "2.000"
    }
  ]
}
```
