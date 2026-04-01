import { NavLink } from 'react-router-dom'

export function AdminNav() {
  return (
    <div className="row" style={{ marginBottom: 12 }}>
      <NavLink to="/" end className="btn">
        لوحة المتابعة
      </NavLink>
      <NavLink to="/apps" className="btn">
        التطبيقات
      </NavLink>
      <NavLink to="/municipalities" className="btn">
        البلديات
      </NavLink>
      <NavLink to="/users" className="btn">
        المستخدمون
      </NavLink>
    </div>
  )
}

