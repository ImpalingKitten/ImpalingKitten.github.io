export class Objectives {
  constructor(ui) {
    this.ui = ui;
    this.steps = [
      { id: 'blueKey', label: 'Find Blue Keycard' },
      { id: 'securityDoor', label: 'Unlock Security Door' },
      { id: 'serverRoom', label: 'Reach Server Room' },
      { id: 'core', label: 'Access Simulation Core' },
      { id: 'glitches', label: 'Trigger Every Glitch' },
      { id: 'escape', label: 'Escape Facility' }
    ];
    this.index = 0;
    this.completed = new Set();
  }

  restore(save) {
    this.index = save?.objectiveIndex ?? 0;
    this.completed = new Set(save?.completedObjectives ?? []);
    this.sync();
  }

  current() {
    return this.steps[this.index] ?? this.steps[this.steps.length - 1];
  }

  complete(id) {
    const step = this.steps[this.index];
    if (!step || step.id !== id) return false;
    this.completed.add(id);
    this.index = Math.min(this.index + 1, this.steps.length - 1);
    this.sync();
    return true;
  }

  sync() {
    this.ui.setObjective(this.current().label, this.index, this.steps.length);
  }

  serialize() {
    return {
      objectiveIndex: this.index,
      completedObjectives: [...this.completed]
    };
  }
}
