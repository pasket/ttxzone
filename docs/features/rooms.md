# Rooms

An exercise can be played by several teams at once, each team in its own room and getting its own injects. There is also a **main room** for everyone together, where the Controller brings Players and projects an inject. Without rooms nothing of this shows anywhere: the exercise is played at one table, as always.

## Decisions (agreed with the user)
- **A Player sees only where they are.** The Controller decides it. The stage shows the Player's room or the main room. The other place's history stays folded below.
- **An inject is played in several rooms.** "All rooms" is the default (an empty `room_ids`), or a subset.
- **The main room has no injects of its own.** The Controller projects any already delivered inject there, or nothing.
- **Configured in Creator → Exercise** (the Rooms panel), Player seating included.
- **Facilitators, Observers, Evaluators and Controllers pick any room** to look at. They see exactly what its Players see.
- **Colour = state.** Rooms are told apart by code and name (`RM-NN`, `CodeRef`), never by colour. The Player's location dot is `accent` (active).

## Model
- `TTX.uses_rooms` is the switch. `TTX.next_room_number` is the `RM-NN` counter, and codes are never reused.
- `TTXRoom` (`ttx_room`) has `code`, `name` (≤ 60, unique per exercise ignoring case, checked in `ttx_room_service`), `description`, `position`. The main room is implicit, never a row.
- `TTXAccess.room_id` is a Player's seat (null: no room, so the main room only), or a session team member's default room (see below); anyone else: 409 `ROOM_PLAYERS_ONLY`.
- `Inject.room_ids` (`ARRAY(Uuid)`, like `recipients`) holds the rooms the inject is played in. Empty means all of them. It is an array, not a link table, so none of the inject delete paths changed.
- No FK cascades: `delete_exercises` drops the rooms after the `TTXAccess` rows and the injects.

## Structure lock
- While the MSEL is READY or a run exists, three things are refused with 409 `ROOMS_LOCKED`: turning rooms on or off, adding a room, and removing one.
- Renaming a room and seating Players stay open at all times, the session included.
- A room that injects are aimed at can't be removed (409 `ROOM_IN_USE`, with the codes), so an inject never silently becomes "all rooms".
- Turning rooms off keeps the rooms and the seats, which are ignored until rooms are on again.

## MSEL
- `InjectInput`/`InjectRead.room_ids`. An unknown room is refused with 422 `UNKNOWN_ROOM`.
- `MselRead.uses_rooms` and `rooms[{id, code, name}]` are part of `msel_read`, so the READY snapshot freezes them.
- Validation rules:
  - M25 `ROOMS_MISSING` (blocking): the exercise is played in rooms but has none.
  - M26 `ROOM_WITHOUT_INJECTS` (warning): no inject is played in a room. An inject for all rooms counts for every room. It is shown in Injects with the room filter.
- Inject dialog, step "Sender and recipients": the "Rooms" chips. "All rooms" comes first and is exclusive. Picking a room clears it, and taking the last room off brings it back.
- The Injects table:
  - each row shows its rooms;
  - there is a room filter;
  - "Group by → Room" (an all-rooms inject shows under each room).
- The MSEL PDF prints the rooms on each card and in the table.

## Session
- The snapshot decides whether the session uses rooms. Seats (`TTXAccess.room_id`) and room names are read live, so a late Player can be seated mid-session.
- Log events:
  - `PLAYERS_MOVED {user_ids, to: main|room}`: the last event for a Player wins. With none, a seated Player is in their room and an unseated one in the main room.
  - `MAIN_PROJECTED {inject_code|null}`: what is on the main room's screen. `main_history` lists every inject projected so far.
  - `PLAYERS_SEATED {assignments}`: a seat changed while the session runs. It sends those Players to their new room, and every view refreshes through `seq`.
- `RunRead.rooms` is null when the exercise is played at one table. Each role gets:

  | Role | Injects | `rooms` |
  |---|---|---|
  | Player | Server-side filtered: the delivered injects of their room, plus every inject ever projected in the main room. Images follow the same filter (`released_image_ids(..., player=)`). | Only their own room, plus `me {room_code, room_name, location}` |
  | Team (Controller, Facilitator, Observer, Evaluator) | Every delivered inject, each with `room_codes` | Every room, with counts |
  | Controller | As the team | Also `players[{user_id, name, room_code, location}]` |

- Controller endpoints:
  - `POST /run/players/move {to, user_ids? | room_code?}`: everyone when neither is given. 409 `PLAYER_WITHOUT_ROOM` when one named Player has no room to go back to.
  - `POST /run/main/project {code|null}`: 409 `INJECT_NOT_RELEASED`.
  - `PUT /run/seats {assignments:[{user_id, room_code|null}]}`.
  - All three answer 409 `ROOMS_NOT_USED` at one table.
- The execution log export (PDF/CSV) lists the three events.

## Screens
- **Creator → Exercise → Edit → Rooms** (`ExerciseRoomsPanel`):
  - the switch (`common/Switch`) and one line;
  - when on, the main room (fixed), the rooms (edit, remove), and "Add room";
  - "Players and their room": a select per row, plus checkboxes and a bulk bar ("Seat here" / "Remove from room"), a "Without a room" filter and search/sort. Never drag-only.
- **Playground** (`RoomBar` + `RoomStage`, in `PlaygroundPage`):
  - A Player gets a band saying where they are, announced with `aria-live` when it changes.
  - The team gets a room switcher (`?room=`, `useViewedRoom`) in the sticky band, showing how many Players are in each place.
  - The stage shows that place: the room's injects, or the main room's screen ("On the main room's screen", or "Nothing on screen").
- **Control center** (`RoomsControlPanel`):
  - what's on screen, with "Stop projecting";
  - everyone to the main room or back;
  - per room: "→ Main room" and "← Back to room", and "who is where" per Player;
  - Players without a room, with "Seat".
- **Control center → inject queue:** each inject's rooms, and "Project" on a delivered one ("On screen" once it is).

## Scenarios
Format version 3 (`docs/features/scenarios.md`): `uses_rooms`, `rooms[{code, name, description}]`, `next_room_number`, and each inject's `room_codes`. Applying a scenario matches rooms by code: a room with the same code keeps its Players (renamed as the file says), a missing one is added, an extra one goes and its Players are left without a room.

## Team members' default room
- `TTXAccess.room_id` on a team row is that member's **default room**: where their view of the session opens. Only team members who follow the session (`ttx_room_service.follows_session`: a Controller, Facilitator, Evaluator or Observer, by row or flag) get one; someone who only plans is refused (409 `ROOM_PLAYERS_ONLY`). Nobody is moved and nothing goes to the log: in the session they still pick any room.
- Set from the same `PUT /ttx/{id}/rooms/assignments`; `RoomsRead.team[{user_id, email, full_name, roles, room_id}]` lists them (Creator → Exercise → Rooms → **Team and their room**, `ExerciseRoomsPanel`'s `TeamRooms`: a select per member).
- `RunRoomsRead.default_room_code` (team viewers only, a room of the snapshot) is what `useViewedRoom` opens on when the URL has no `?room=`; without one, the first room as before.

## Each place on its own
Key questions, the team's notes on an inject and EEG ratings belong to the place in view: the room picked in the switcher (`useStageRoom`), the main room counting as one more, as with decisions and polls. Requests name it with `room_code` (or `?room=` on a read); without rooms none is sent and nothing changes. `_place` resolves it, and an unknown room answers 404 `ROOM_NOT_FOUND`.

- **Key questions**: `QUESTIONS_RELEASED` and `QUESTION_COVERED` carry `room_code`, and go on the inject in play there (`_in_play`: the room's latest, the main room's screen; 409 `NO_INJECT_IN_PLAY` when there's none). The same question in another room is another question: asked and covered on its own. `RunControlPhaseRead` and `RunFacilitationRead` add `question_places`, read through `phaseQuestions`; `RunInjectRead.questions` carry their `room_code`, a Player receives only their places' and the stage shows the place's (`questionsOf`).
- **Notes**: `RunNote.room_code` on a team member's note on an inject. The general note isn't about a place, so every room shows the same one, and a Player's stay private and roomless, wherever they were.
- **Ratings**: `RunRating.room_code`, part of its key: one Evaluator rates a point once per place. `GET /run/evaluation?room=` answers that place, and the panel shows which, with what's in play and what was decided there. `rated` and `total` count that place. The Session summary's progress counts a point rated in any place.
- **Reports**: the ratings and notes carry their room: the report's "From the session" ratings, its seeded strengths and areas for improvement (`RM-01: …`), the team's notes, the session's PDF and the AI assistant's session record. The main room gets no mark in seeded text and PDFs: it's the plenary. An objective's overall level is the most frequent across all rooms, for the authors to settle.

Expected actions stay per inject: the Controller marks each once, for all its rooms.

## Not in this version
- A poll of the MSEL (`docs/features/playground.md` → Decisions and votes) opens one vote per room it's played in, and one in the main room when projected there; each place sees and decides its own.
