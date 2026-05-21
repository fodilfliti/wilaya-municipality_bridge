/** Mail compose / validation pickers — expose profile job_title only (not access-role template names). */

function mapUsersForMailPicker(users) {
  return users.map((u) => {
    const plain = u.get ? u.get({ plain: true }) : u;
    return {
      id: Number(plain.id),
      username: plain.username,
      name: plain.name,
      role: plain.role,
      job_title: plain.job_title,
    };
  });
}

module.exports = { mapUsersForMailPicker };
